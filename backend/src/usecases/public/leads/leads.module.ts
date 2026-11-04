import { Module } from '@nestjs/common';

import { Clock } from '~module/common';
import { VisitorIpHasher } from '~module/common';
import { LeadNotificationModule } from '~module/lead-notification';
import { TelegramModule } from '~module/telegram';
import { DecoyLeadId } from '~usecases/public/leads/lead-submission/post/decoy-lead-id';
import { LeadSubmissionController } from '~usecases/public/leads/lead-submission/post/lead-submission.controller';
import { LeadSubmissionRepository } from '~usecases/public/leads/lead-submission/post/lead-submission.repository';
import { LeadSubmissionUsecase } from '~usecases/public/leads/lead-submission/post/lead-submission.usecase';

/**
 * Slice S2 (leads, public side): POST /api/v1/public/leads — validation with forms.errors.* keys,
 * honeypot, rate limit by IP hash + global ceiling, store, Telegram notification. Owned by the leads
 * slice; usecases live under ./ (src/usecases/public/leads/<feature>/<method>/), registered here only.
 */
@Module({
  imports: [TelegramModule, LeadNotificationModule],
  controllers: [LeadSubmissionController],
  providers: [LeadSubmissionUsecase, LeadSubmissionRepository, VisitorIpHasher, DecoyLeadId, Clock],
})
export class LeadsModule {}
