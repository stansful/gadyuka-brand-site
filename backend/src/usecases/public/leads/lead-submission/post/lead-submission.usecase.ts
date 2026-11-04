import { Injectable, Logger } from '@nestjs/common';

import { LeadFormRules } from '~core/leads/lead-form.rules';
import { LeadMeta, LeadMetaRecord } from '~core/leads/lead-meta';
import { LeadRateWindow } from '~core/leads/lead-rate-window';
import { CheckedLeadForm, LeadSubmission } from '~core/leads/lead-submission';
import { Clock } from '~module/common';
import { VisitorIpHasher } from '~module/common';
import { LeadNotificationScheduler } from '~module/lead-notification';
import { TelegramLead, TelegramMessageKey, TelegramTexts } from '~module/telegram';
import { Usecase } from '~usecases/usecase.interfaces';

import { DecoyLeadId } from './decoy-lead-id';
import { LeadRateLimitedException } from './lead-rate-limited.exception';
import { LeadSubmissionRepository } from './lead-submission.repository';
import { LeadSubmissionResponse } from './lead-submission.response';
import { LockedLeadStore } from './locked-lead.store';

/** Who sent the form (forwarded by the site's server). */
export interface LeadVisitor {
  readonly clientIp: string;
  readonly userAgent: string | undefined;
  readonly referer: string | undefined;
}

export interface LeadSubmissionCommand {
  /** The form after the request checks (unchecked when the honeypot is filled) */
  readonly form: Omit<CheckedLeadForm, 'locale'>;
  /** The page's language as sent (anything unknown → the default locale) */
  readonly locale: unknown;
  /** The honeypot field as sent */
  readonly honeypot: unknown;
  readonly visitor: LeadVisitor;
}

interface PendingLead {
  readonly submission: LeadSubmission;
  readonly ipHash: string;
  readonly meta: LeadMetaRecord;
  readonly receivedAt: Date;
  /**
   * Lead.telegramError should the lead land past the site-wide ceiling. Resolved BEFORE the network's
   * transaction opens: the texts may need a database read (cold messages cache) through the main client,
   * and from inside the transaction that read waits for a pool connection which the open lead
   * transactions hold — under a flood none frees up and every lead is rolled back.
   */
  readonly ceilingNotice: string;
}

interface AdmittedLead {
  readonly lead: TelegramLead;
  readonly shouldNotify: boolean;
}

/**
 * A lead from the site's form: honeypot → pretend success; else, serialized per visitor network, refuse
 * past the network's limit (429) or store the lead — always BEFORE Telegram is contacted, so a Telegram
 * outage never loses a lead — then notify the owner in the background. Past the site-wide ceiling the
 * lead is stored «not sent» (with the reason) and no notification goes out: no chat / API flood.
 */
@Injectable()
export class LeadSubmissionUsecase implements Usecase<LeadSubmissionCommand, LeadSubmissionResponse> {
  private readonly logger = new Logger(LeadSubmissionUsecase.name);

  constructor(
    private readonly repository: LeadSubmissionRepository,
    private readonly hasher: VisitorIpHasher,
    private readonly texts: TelegramTexts,
    private readonly notifications: LeadNotificationScheduler,
    private readonly decoyIds: DecoyLeadId,
    private readonly clock: Clock,
  ) {}

  async execute({ form, locale, honeypot, visitor }: LeadSubmissionCommand): Promise<LeadSubmissionResponse> {
    if (LeadFormRules.isHoneypotFilled({ hp: honeypot })) {
      return this.ignoreBot();
    }
    const pending = await this.pendingLeadOf({ ...form, locale }, visitor);
    const admitted = await this.repository.withNetworkLock(pending.ipHash, store => this.admit(store, pending));
    this.logger.log('LeadSubmissionUsecase : lead stored', { lead_id: admitted.lead.id, type: admitted.lead.type });
    this.notifyOwner(admitted);
    return LeadSubmissionResponse.of(admitted.lead.id);
  }

  /** Looks like a success, so the bot learns nothing; nothing is stored or sent. */
  private ignoreBot(): LeadSubmissionResponse {
    this.logger.warn('LeadSubmissionUsecase : honeypot filled, submission ignored');
    return LeadSubmissionResponse.of(this.decoyIds.create(this.clock.now()));
  }

  private async pendingLeadOf(form: CheckedLeadForm, visitor: LeadVisitor): Promise<PendingLead> {
    const receivedAt = new Date(this.clock.now());
    return {
      submission: LeadSubmission.fromCheckedForm(form),
      ipHash: this.hasher.hashOf(visitor.clientIp),
      meta: LeadMeta.of({ receivedAt, userAgent: visitor.userAgent, referer: visitor.referer }),
      receivedAt,
      ceilingNotice: await this.ceilingNotice(),
    };
  }

  /**
   * Runs inside the network's lock: the limit check and the insert cannot race. Only the transaction's
   * own queries here — no I/O through the main client (see PendingLead.ceilingNotice).
   */
  private async admit(store: LockedLeadStore, pending: PendingLead): Promise<AdmittedLead> {
    await this.assertNetworkHasRoom(store, pending);
    const shouldNotify = await this.isBelowCeiling(store, pending.receivedAt);
    const lead = await store.insert({ ...pending, telegramError: shouldNotify ? null : pending.ceilingNotice });
    return { lead, shouldNotify };
  }

  private async assertNetworkHasRoom(store: LockedLeadStore, { ipHash, receivedAt }: PendingLead): Promise<void> {
    const window = LeadRateWindow.PER_NETWORK;
    const since = window.startOf(receivedAt);
    if (!window.isFullWith(await store.countOfNetworkSince(ipHash, since))) {
      return;
    }
    const oldest = await store.findOldestOfNetworkSince(ipHash, since);
    throw new LeadRateLimitedException(window.retryAfterSeconds(oldest, receivedAt));
  }

  private async isBelowCeiling(store: LockedLeadStore, receivedAt: Date): Promise<boolean> {
    const ceiling = LeadRateWindow.SITE_WIDE;
    return !ceiling.isFullWith(await store.countSince(ceiling.startOf(receivedAt)));
  }

  /** Lead.telegramError of a lead stored past the site-wide ceiling (telegram.errors.notifyCeiling). */
  private async ceilingNotice(): Promise<string> {
    await this.texts.load();
    const { max, minutes } = LeadRateWindow.SITE_WIDE;
    return this.texts.text(TelegramMessageKey.ERROR_NOTIFY_CEILING, { max, minutes });
  }

  private notifyOwner({ lead, shouldNotify }: AdmittedLead): void {
    if (shouldNotify) {
      this.notifications.schedule(lead);
      return;
    }
    const { max, minutes } = LeadRateWindow.SITE_WIDE;
    this.logger.warn('LeadSubmissionUsecase : site-wide ceiling reached, no Telegram notification', {
      lead_id: lead.id,
      max,
      minutes,
    });
  }
}
