import { LeadMetaRecord } from '~core/leads/lead-meta';
import { LeadSubmission } from '~core/leads/lead-submission';
import { TelegramLead } from '~module/telegram';
import { Prisma } from '~prisma-generated/prisma/client';

/** A lead to insert: the checked form, the visitor's network hash and the request metadata. */
export interface NewLeadRow {
  readonly submission: LeadSubmission;
  readonly ipHash: string;
  readonly meta: LeadMetaRecord;
  /** null = the owner will be notified; else why not (the site-wide ceiling notice) */
  readonly telegramError: string | null;
}

const TELEGRAM_LEAD_SELECT = {
  id: true,
  type: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  locale: true,
  createdAt: true,
} satisfies Prisma.LeadSelect;

/**
 * The leads table inside the transaction of LeadSubmissionRepository.withNetworkLock: counts and the
 * insert see each other, so parallel requests of one network cannot all pass the limit.
 */
export class LockedLeadStore {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  /** Leads of the network created at or after `since` (index ip_hash, created_at). */
  countOfNetworkSince(ipHash: string, since: Date): Promise<number> {
    return this.transaction.lead.count({ where: { ipHash, createdAt: { gte: since } } });
  }

  async findOldestOfNetworkSince(ipHash: string, since: Date): Promise<Date | undefined> {
    const oldest = await this.transaction.lead.findFirst({
      where: { ipHash, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    return oldest?.createdAt;
  }

  /** Leads of every visitor created at or after `since`. */
  countSince(since: Date): Promise<number> {
    return this.transaction.lead.count({ where: { createdAt: { gte: since } } });
  }

  insert({ submission, ipHash, meta, telegramError }: NewLeadRow): Promise<TelegramLead> {
    const { type, name, email, phone, message, locale } = submission;
    return this.transaction.lead.create({
      data: { type, name, email, phone, message, locale, ipHash, meta, telegramError },
      select: TELEGRAM_LEAD_SELECT,
    });
  }
}
