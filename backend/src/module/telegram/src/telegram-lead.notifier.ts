import { Inject, Injectable, Logger } from '@nestjs/common';

import { LeadMessageFormatter } from './lead-message.formatter';
import { TelegramMessageKey } from './telegram-message-key.enum';
import { TelegramTexts } from './telegram-texts';
import { TELEGRAM_DEFAULTS, TELEGRAM_OPTIONS } from './telegram.constants';
import { TelegramDeliveryStatus, TelegramLead, TelegramOptions, TelegramSendResult } from './telegram.interfaces';
import { TelegramTransport } from './telegram.transport';

/**
 * Notifies the owner about a lead. Never throws: a failure becomes a FAILED result with an
 * owner-facing error (the caller stores it as Lead.telegramError, so the lead can be re-sent from
 * the admin). A dry run logs a preview without personal data.
 */
@Injectable()
export class TelegramLeadNotifier {
  private readonly logger = new Logger(TelegramLeadNotifier.name);
  private hasWarnedAboutProductionDryRun = false;

  constructor(
    @Inject(TELEGRAM_OPTIONS) private readonly options: TelegramOptions,
    private readonly transport: TelegramTransport,
    private readonly formatter: LeadMessageFormatter,
    private readonly texts: TelegramTexts,
  ) {}

  async notify(lead: TelegramLead): Promise<TelegramSendResult> {
    await this.texts.load();
    try {
      const result = await this.transport.send(this.formatter.formatForOwner(lead, this.options.siteUrl));
      this.report(lead, result);
      return result;
    } catch (error: unknown) {
      this.logger.error(`TelegramLeadNotifier : unexpected error`, { lead_id: lead.id, error });
      return { status: TelegramDeliveryStatus.FAILED, error: this.internalError(error) };
    }
  }

  /** Lead.telegramError of a result: null for a delivery, the dry-run notice or the error otherwise. */
  errorOf(result: TelegramSendResult): string | null {
    const errors: Record<TelegramDeliveryStatus, () => string | null> = {
      [TelegramDeliveryStatus.SENT]: () => null,
      [TelegramDeliveryStatus.DRY_RUN]: () => this.texts.text(TelegramMessageKey.ERROR_DRY_RUN),
      [TelegramDeliveryStatus.FAILED]: () =>
        ('error' in result ? result.error : '').slice(0, TELEGRAM_DEFAULTS.maxErrorLength),
    };
    return errors[result.status]();
  }

  private report(lead: TelegramLead, result: TelegramSendResult): void {
    const reporters: Record<TelegramDeliveryStatus, () => void> = {
      [TelegramDeliveryStatus.SENT]: () => undefined,
      [TelegramDeliveryStatus.DRY_RUN]: () => this.reportDryRun(lead),
      [TelegramDeliveryStatus.FAILED]: () =>
        this.logger.warn('TelegramLeadNotifier : lead saved but not delivered', {
          lead_id: lead.id,
          error: this.errorOf(result),
        }),
    };
    reporters[result.status]();
  }

  private reportDryRun(lead: TelegramLead): void {
    this.warnAboutProductionDryRun();
    this.logger.log(
      `TelegramLeadNotifier : dry run, message not sent. Preview:\n${this.formatter.formatPreview(lead)}`,
    );
  }

  private warnAboutProductionDryRun(): void {
    if (this.hasWarnedAboutProductionDryRun || !this.options.isProduction) {
      return;
    }
    this.hasWarnedAboutProductionDryRun = true;
    this.logger.warn('TelegramLeadNotifier : TELEGRAM_DRY_RUN=1 in production — leads are saved but NOT sent');
  }

  private internalError(error: unknown): string {
    const details = error instanceof Error ? error.message : String(error);
    return this.texts.text(TelegramMessageKey.ERROR_INTERNAL, { details });
  }
}
