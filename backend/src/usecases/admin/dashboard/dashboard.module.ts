import { Module } from '@nestjs/common';

import { DashboardNewLeadsController } from '~usecases/admin/dashboard/dashboard-new-leads/get/dashboard-new-leads.controller';
import { DashboardNewLeadsRepository } from '~usecases/admin/dashboard/dashboard-new-leads/get/dashboard-new-leads.repository';
import { DashboardNewLeadsUsecase } from '~usecases/admin/dashboard/dashboard-new-leads/get/dashboard-new-leads.usecase';
import { DashboardController } from '~usecases/admin/dashboard/dashboard/get/dashboard.controller';
import { DashboardRepository } from '~usecases/admin/dashboard/dashboard/get/dashboard.repository';
import { DashboardUsecase } from '~usecases/admin/dashboard/dashboard/get/dashboard.usecase';
import { SiteTextsModule } from '~usecases/admin/site-texts/site-texts.module';
import { VisitRepository } from '~usecases/public/content/common/visit.repository';

/**
 * Slice S3 (dashboard): /api/v1/admin/dashboard — counters and the latest leads of the admin home page —
 * and /api/v1/admin/dashboard/new-leads (the badge of the sidebar). Every controller:
 * `@Roles([UserRole.ADMIN])`. The texts card reads SiteTextOverview of the site texts module.
 */
@Module({
  imports: [SiteTextsModule],
  controllers: [DashboardController, DashboardNewLeadsController],
  providers: [
    DashboardUsecase,
    DashboardRepository,
    DashboardNewLeadsUsecase,
    DashboardNewLeadsRepository,
    VisitRepository,
  ],
})
export class DashboardModule {}
