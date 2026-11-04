import { Module } from '@nestjs/common';

import { CatalogModule } from '~usecases/admin/catalog/catalog.module';
import { AdminContentModule } from '~usecases/admin/content/content.module';
import { DashboardModule } from '~usecases/admin/dashboard/dashboard.module';
import { AdminEntitiesModule } from '~usecases/admin/entities/entities.module';
import { AdminLeadsModule } from '~usecases/admin/leads/admin-leads.module';
import { AdminMediaModule } from '~usecases/admin/media/admin-media.module';
import { ServerMetricsModule } from '~usecases/admin/server-metrics/server-metrics.module';
import { SiteTextsModule } from '~usecases/admin/site-texts/site-texts.module';

/**
 * The admin panel API (/api/v1/admin/*): one feature module per slice — each slice registers its
 * controllers and providers in its OWN module only, never here. Every controller is decorated with
 * `@Roles([UserRole.ADMIN])` (RolesGuard) on top of the global AuthGuard; src/test/route-access.e2e.test.ts
 * checks it for every route under /api/v1/admin.
 */
@Module({
  imports: [
    AdminEntitiesModule,
    DashboardModule,
    SiteTextsModule,
    CatalogModule,
    AdminContentModule,
    AdminMediaModule,
    AdminLeadsModule,
    ServerMetricsModule,
  ],
})
export class AdminModule {}
