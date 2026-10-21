import { Module } from '@nestjs/common';

import { SiteImageSavePlanner } from '~core/site-texts/site-image-save.planner';
import { SiteTextRegistry } from '~core/site-texts/site-text-registry';
import { SiteTextSavePlanner } from '~core/site-texts/site-text-save.planner';
import { MessageCatalog, MessagesModule } from '~module/messages';
import { SiteMessagesModule } from '~module/site-messages';
import { SiteTextDefinitions } from '~usecases/admin/site-texts/common/site-text-definitions';
import { SiteTextEntriesBuilder } from '~usecases/admin/site-texts/common/site-text-entries.builder';
import { SiteTextLabels } from '~usecases/admin/site-texts/common/site-text-labels';
import { SiteTextOverview } from '~usecases/admin/site-texts/common/site-text-overview';
import { SiteTextRowsRepository } from '~usecases/admin/site-texts/common/site-text-rows.repository';
import { SiteTextValueChecker } from '~usecases/admin/site-texts/common/site-text-value.checker';
import { SiteTextsStore } from '~usecases/admin/site-texts/common/site-texts.store';
import { SiteTextsPageController } from '~usecases/admin/site-texts/site-texts-page/get/site-texts-page.controller';
import { SiteTextsPageRepository } from '~usecases/admin/site-texts/site-texts-page/get/site-texts-page.repository';
import { SiteTextsPageUsecase } from '~usecases/admin/site-texts/site-texts-page/get/site-texts-page.usecase';
import { SiteTextsResetController } from '~usecases/admin/site-texts/site-texts-reset/post/site-texts-reset.controller';
import { SiteTextsResetUsecase } from '~usecases/admin/site-texts/site-texts-reset/post/site-texts-reset.usecase';
import { SiteTextsSaveChecker } from '~usecases/admin/site-texts/site-texts-save/put/site-texts-save.checker';
import { SiteTextsSaveController } from '~usecases/admin/site-texts/site-texts-save/put/site-texts-save.controller';
import { SiteTextsSaveRepository } from '~usecases/admin/site-texts/site-texts-save/put/site-texts-save.repository';
import { SiteTextsSaveUsecase } from '~usecases/admin/site-texts/site-texts-save/put/site-texts-save.usecase';

/**
 * Slice S3 (site texts + landing images): /api/v1/admin/site-texts — the page (sections with counters,
 * one section or a search), save with the optimistic conflict check under the «Тексты сайта» advisory
 * lock, reset to the default. After every write: `SiteMessagesService.invalidate()`. Every controller:
 * `@Roles([UserRole.ADMIN])`. Exports SiteTextOverview (the texts card of the dashboard).
 */
@Module({
  imports: [MessagesModule, SiteMessagesModule],
  controllers: [SiteTextsPageController, SiteTextsSaveController, SiteTextsResetController],
  providers: [
    { provide: SiteTextRegistry, useValue: new SiteTextRegistry() },
    { provide: SiteImageSavePlanner, useValue: new SiteImageSavePlanner() },
    {
      provide: SiteTextSavePlanner,
      inject: [MessageCatalog],
      useFactory: (catalog: MessageCatalog) => new SiteTextSavePlanner(catalog),
    },
    SiteTextDefinitions,
    SiteTextEntriesBuilder,
    SiteTextLabels,
    SiteTextRowsRepository,
    SiteTextOverview,
    SiteTextValueChecker,
    SiteTextsStore,
    SiteTextsPageUsecase,
    SiteTextsPageRepository,
    SiteTextsSaveChecker,
    SiteTextsSaveUsecase,
    SiteTextsSaveRepository,
    SiteTextsResetUsecase,
  ],
  exports: [SiteTextOverview],
})
export class SiteTextsModule {}
