import { Module } from '@nestjs/common';

import { LeadNotificationModule } from '~module/lead-notification';
import { LeadDetailController } from '~usecases/admin/leads/lead-detail/get/lead-detail.controller';
import { LeadDetailRepository } from '~usecases/admin/leads/lead-detail/get/lead-detail.repository';
import { LeadDetailUsecase } from '~usecases/admin/leads/lead-detail/get/lead-detail.usecase';
import { LeadListController } from '~usecases/admin/leads/lead-list/get/lead-list.controller';
import { LeadListRepository } from '~usecases/admin/leads/lead-list/get/lead-list.repository';
import { LeadListUsecase } from '~usecases/admin/leads/lead-list/get/lead-list.usecase';
import { LeadResendController } from '~usecases/admin/leads/lead-resend/post/lead-resend.controller';
import { LeadResendRepository } from '~usecases/admin/leads/lead-resend/post/lead-resend.repository';
import { LeadResendUsecase } from '~usecases/admin/leads/lead-resend/post/lead-resend.usecase';
import { LeadStatusController } from '~usecases/admin/leads/lead-status/patch/lead-status.controller';
import { LeadStatusRepository } from '~usecases/admin/leads/lead-status/patch/lead-status.repository';
import { LeadStatusUsecase } from '~usecases/admin/leads/lead-status/patch/lead-status.usecase';
import { LeadTelegramStatusController } from '~usecases/admin/leads/lead-telegram-status/get/lead-telegram-status.controller';
import { LeadTelegramStatusUsecase } from '~usecases/admin/leads/lead-telegram-status/get/lead-telegram-status.usecase';

/**
 * Slice S2 (leads, admin side): /api/v1/admin/leads — list (filters, pagination), detail, status,
 * Telegram re-send, the dry-run status. Every controller: `@Roles([UserRole.ADMIN])`. Usecases live
 * under ./ and are registered here only.
 */
@Module({
  imports: [LeadNotificationModule],
  controllers: [
    LeadTelegramStatusController,
    LeadListController,
    LeadDetailController,
    LeadStatusController,
    LeadResendController,
  ],
  providers: [
    LeadTelegramStatusUsecase,
    LeadListUsecase,
    LeadListRepository,
    LeadDetailUsecase,
    LeadDetailRepository,
    LeadStatusUsecase,
    LeadStatusRepository,
    LeadResendUsecase,
    LeadResendRepository,
  ],
})
export class AdminLeadsModule {}
