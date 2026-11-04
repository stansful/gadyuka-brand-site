import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { Clock, VisitorIpHasher } from '~module/common';
import { SiteMessagesModule } from '~module/site-messages';
import { PublicCollectionPresenter } from '~usecases/public/content/common/public-collection.presenter';
import { PublicImagePresenter } from '~usecases/public/content/common/public-image.presenter';
import { PublicSettingsPresenter } from '~usecases/public/content/common/public-settings.presenter';
import { PublicSettingsRepository } from '~usecases/public/content/common/public-settings.repository';
import { PublishedCollectionsRepository } from '~usecases/public/content/common/published-collections.repository';
import { VisitTrackingInterceptor } from '~usecases/public/content/common/visit-tracking.interceptor';
import { VisitRepository } from '~usecases/public/content/common/visit.repository';
import { LandingFramePresenter } from '~usecases/public/content/landing/get/landing-frame.presenter';
import { LandingRowsLoader } from '~usecases/public/content/landing/get/landing-rows.loader';
import { LandingSectionsPresenter } from '~usecases/public/content/landing/get/landing-sections.presenter';
import { LandingController } from '~usecases/public/content/landing/get/landing.controller';
import { LandingPresenter } from '~usecases/public/content/landing/get/landing.presenter';
import { LandingRepository } from '~usecases/public/content/landing/get/landing.repository';
import { LandingUsecase } from '~usecases/public/content/landing/get/landing.usecase';
import { PublicCollectionController } from '~usecases/public/content/public-collection/get/public-collection.controller';
import { PublicCollectionUsecase } from '~usecases/public/content/public-collection/get/public-collection.usecase';
import { PublicSettingsController } from '~usecases/public/content/public-settings/get/public-settings.controller';
import { PublicSettingsUsecase } from '~usecases/public/content/public-settings/get/public-settings.usecase';
import { PublishedCollectionsController } from '~usecases/public/content/published-collections/get/published-collections.controller';
import { PublishedCollectionsUsecase } from '~usecases/public/content/published-collections/get/published-collections.usecase';
import { SiteMessagesController } from '~usecases/public/content/site-messages/get/site-messages.controller';
import { SiteMessagesUsecase } from '~usecases/public/content/site-messages/get/site-messages.usecase';
import { SitemapController } from '~usecases/public/content/sitemap/get/sitemap.controller';
import { SitemapRepository } from '~usecases/public/content/sitemap/get/sitemap.repository';
import { SitemapUsecase } from '~usecases/public/content/sitemap/get/sitemap.usecase';

/**
 * Slice S1 (public content reads): everything the public site renders, all @Public under
 * /api/v1/public/* (the frontend caches it with 'use cache' + cacheTag('content')):
 * - GET landing/:locale — the landing (texts, images, menu, socials, catalog, sections, settings);
 * - GET messages/:locale — the site UI messages (next-intl);
 * - GET collections/:slug?locale= — one published collection; GET collections — published slugs;
 * - GET sitemap — lastmod of every public page; GET settings/:locale — contacts, review scale, SEO.
 */
@Module({
  imports: [SiteMessagesModule],
  controllers: [
    SiteMessagesController,
    LandingController,
    PublicCollectionController,
    PublishedCollectionsController,
    SitemapController,
    PublicSettingsController,
  ],
  providers: [
    Clock,
    PublicImagePresenter,
    PublicCollectionPresenter,
    PublicSettingsPresenter,
    PublicSettingsRepository,
    PublishedCollectionsRepository,
    SiteMessagesUsecase,
    LandingUsecase,
    LandingRowsLoader,
    LandingRepository,
    LandingPresenter,
    LandingFramePresenter,
    LandingSectionsPresenter,
    PublicCollectionUsecase,
    PublishedCollectionsUsecase,
    SitemapUsecase,
    SitemapRepository,
    PublicSettingsUsecase,
    VisitorIpHasher,
    VisitRepository,
    { provide: APP_INTERCEPTOR, useClass: VisitTrackingInterceptor },
  ],
})
export class PublicContentModule {}
