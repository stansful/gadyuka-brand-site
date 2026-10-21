import { Inject, Injectable, Logger } from '@nestjs/common';

import { TelegramDeliveryStatus, TelegramLead, TelegramLeadNotifier, TelegramSendResult } from '~module/telegram';

import { ILeadDeliveryRepository, LeadDelivery } from './lead-delivery';
import { LEAD_DELIVERY_REPOSITORY } from './lead-notification.constants';

/**
 * Notifies the owner about a stored lead in Telegram and stores the outcome on the lead, so a lead that
 * did not reach Telegram shows «не доставлено» in the admin and can be re-sent. Never throws: a failed
 * notification is an outcome, and when even storing the outcome fails it is logged and still returned.
 */
@Injectable()
export class LeadTelegramDelivery {
  private readonly logger = new Logger(LeadTelegramDelivery.name);

  constructor(
    private readonly notifier: TelegramLeadNotifier,
    @Inject(LEAD_DELIVERY_REPOSITORY) private readonly repository: ILeadDeliveryRepository,
  ) {}

  async deliver(lead: TelegramLead): Promise<LeadDelivery> {
    const delivery = this.deliveryOf(await this.notifier.notify(lead));
    await this.store(lead.id, delivery);
    return delivery;
  }

  private deliveryOf(result: TelegramSendResult): LeadDelivery {
    return {
      telegramSent: result.status === TelegramDeliveryStatus.SENT,
      telegramError: this.notifier.errorOf(result),
    };
  }

  /** The lead stays as it was («не доставлено») when its outcome cannot be written; the outcome is still answered. */
  private async store(leadId: string, delivery: LeadDelivery): Promise<void> {
    try {
      await this.repository.saveDelivery(leadId, delivery);
    } catch (error: unknown) {
      this.logger.warn('LeadTelegramDelivery : the delivery outcome was not stored', {
        lead_id: leadId,
        telegram_sent: delivery.telegramSent,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
