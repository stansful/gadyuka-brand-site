import { Module } from '@nestjs/common';

import { TelegramModule } from '~module/telegram';

import { LeadDeliveryRepository } from './lead-delivery.repository';
import { LEAD_DELIVERY_REPOSITORY } from './lead-notification.constants';
import { LeadNotificationScheduler } from './lead-notification.scheduler';
import { LeadTelegramDelivery } from './lead-telegram.delivery';

/** Telegram notifications about leads with their outcome stored on the lead (new leads, admin re-send). */
@Module({
  imports: [TelegramModule],
  providers: [
    { provide: LEAD_DELIVERY_REPOSITORY, useClass: LeadDeliveryRepository },
    LeadTelegramDelivery,
    LeadNotificationScheduler,
  ],
  exports: [LeadTelegramDelivery, LeadNotificationScheduler],
})
export class LeadNotificationModule {}
