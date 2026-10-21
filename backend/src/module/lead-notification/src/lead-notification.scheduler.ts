import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { TelegramLead } from '~module/telegram';

import { LeadTelegramDelivery } from './lead-telegram.delivery';

/**
 * Notifies the owner about a new lead in the background, so the visitor's answer never waits for
 * Telegram (the lead is stored before). A shutdown waits for the notifications in flight.
 */
@Injectable()
export class LeadNotificationScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(LeadNotificationScheduler.name);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(private readonly delivery: LeadTelegramDelivery) {}

  schedule(lead: TelegramLead): void {
    const task = this.notify(lead).finally(() => this.inFlight.delete(task));
    this.inFlight.add(task);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.inFlight);
  }

  /**
   * deliver() never throws; this guard only keeps a broken promise from becoming an unhandled rejection
   * (which would stop the process) — the lead stays «не доставлено» and can be re-sent from the admin.
   */
  private async notify(lead: TelegramLead): Promise<void> {
    try {
      await this.delivery.deliver(lead);
    } catch (error: unknown) {
      this.logger.error('LeadNotificationScheduler : the notification failed unexpectedly', {
        lead_id: lead.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
