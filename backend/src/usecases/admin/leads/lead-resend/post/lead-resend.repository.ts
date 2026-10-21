import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { TelegramLead } from '~module/telegram';
import { Prisma } from '~prisma-generated/prisma/client';

/** The fields of a lead its Telegram message shows. */
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

@Injectable()
export class LeadResendRepository {
  constructor(private readonly database: DatabaseService) {}

  /** The fields of the lead its Telegram message shows, or null. */
  findTelegramLead(id: string): Promise<TelegramLead | null> {
    return this.database.client.lead.findUnique({ where: { id }, select: TELEGRAM_LEAD_SELECT });
  }
}
