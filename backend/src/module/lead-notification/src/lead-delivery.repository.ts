import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

import { ILeadDeliveryRepository, LeadDelivery } from './lead-delivery';

/** Lead.telegramSent / telegramError in Postgres. */
@Injectable()
export class LeadDeliveryRepository implements ILeadDeliveryRepository {
  constructor(private readonly database: DatabaseService) {}

  async saveDelivery(leadId: string, { telegramSent, telegramError }: LeadDelivery): Promise<void> {
    await this.database.client.lead.update({
      where: { id: leadId },
      data: { telegramSent, telegramError },
      select: { id: true },
    });
  }
}
