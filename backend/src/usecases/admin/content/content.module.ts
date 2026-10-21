import { Module } from '@nestjs/common';

import { Clock } from '~module/common';
import { SiteMessagesModule } from '~module/site-messages';
import { AdminCommonModule } from '~usecases/admin/common/admin-common.module';
import { GalleryRepository } from '~usecases/admin/content/common/gallery/gallery.repository';
import { MenuItemRepository } from '~usecases/admin/content/common/menu/menu-item.repository';
import { NewsSlugChecker } from '~usecases/admin/content/common/news/news-slug.checker';
import { NewsRepository } from '~usecases/admin/content/common/news/news.repository';
import { OfferRepository } from '~usecases/admin/content/common/offers/offer.repository';
import { PartnerRepository } from '~usecases/admin/content/common/partners/partner.repository';
import { SocialLinkRepository } from '~usecases/admin/content/common/socials/social-link.repository';
import { GalleryBulkController } from '~usecases/admin/content/gallery-bulk/post/gallery-bulk.controller';
import { GalleryBulkUsecase } from '~usecases/admin/content/gallery-bulk/post/gallery-bulk.usecase';
import { GalleryCreateController } from '~usecases/admin/content/gallery-create/post/gallery-create.controller';
import { GalleryCreateUsecase } from '~usecases/admin/content/gallery-create/post/gallery-create.usecase';
import { GalleryDetailsController } from '~usecases/admin/content/gallery-details/get/gallery-details.controller';
import { GalleryDetailsUsecase } from '~usecases/admin/content/gallery-details/get/gallery-details.usecase';
import { GalleryListController } from '~usecases/admin/content/gallery-list/get/gallery-list.controller';
import { GalleryListUsecase } from '~usecases/admin/content/gallery-list/get/gallery-list.usecase';
import { GalleryUpdateController } from '~usecases/admin/content/gallery-update/put/gallery-update.controller';
import { GalleryUpdateUsecase } from '~usecases/admin/content/gallery-update/put/gallery-update.usecase';
import { MenuItemCreateController } from '~usecases/admin/content/menu-item-create/post/menu-item-create.controller';
import { MenuItemCreateUsecase } from '~usecases/admin/content/menu-item-create/post/menu-item-create.usecase';
import { MenuItemDetailsController } from '~usecases/admin/content/menu-item-details/get/menu-item-details.controller';
import { MenuItemDetailsUsecase } from '~usecases/admin/content/menu-item-details/get/menu-item-details.usecase';
import { MenuItemListController } from '~usecases/admin/content/menu-item-list/get/menu-item-list.controller';
import { MenuItemListUsecase } from '~usecases/admin/content/menu-item-list/get/menu-item-list.usecase';
import { MenuItemUpdateController } from '~usecases/admin/content/menu-item-update/put/menu-item-update.controller';
import { MenuItemUpdateUsecase } from '~usecases/admin/content/menu-item-update/put/menu-item-update.usecase';
import { MenuLinkTargetsController } from '~usecases/admin/content/menu-link-targets/get/menu-link-targets.controller';
import { MenuLinkTargetsRepository } from '~usecases/admin/content/menu-link-targets/get/menu-link-targets.repository';
import { MenuLinkTargetsUsecase } from '~usecases/admin/content/menu-link-targets/get/menu-link-targets.usecase';
import { NewsCreateController } from '~usecases/admin/content/news-create/post/news-create.controller';
import { NewsCreateUsecase } from '~usecases/admin/content/news-create/post/news-create.usecase';
import { NewsDetailsController } from '~usecases/admin/content/news-details/get/news-details.controller';
import { NewsDetailsUsecase } from '~usecases/admin/content/news-details/get/news-details.usecase';
import { NewsListController } from '~usecases/admin/content/news-list/get/news-list.controller';
import { NewsListUsecase } from '~usecases/admin/content/news-list/get/news-list.usecase';
import { NewsUpdateController } from '~usecases/admin/content/news-update/put/news-update.controller';
import { NewsUpdateUsecase } from '~usecases/admin/content/news-update/put/news-update.usecase';
import { OfferCreateController } from '~usecases/admin/content/offer-create/post/offer-create.controller';
import { OfferCreateUsecase } from '~usecases/admin/content/offer-create/post/offer-create.usecase';
import { OfferDetailsController } from '~usecases/admin/content/offer-details/get/offer-details.controller';
import { OfferDetailsUsecase } from '~usecases/admin/content/offer-details/get/offer-details.usecase';
import { OfferListController } from '~usecases/admin/content/offer-list/get/offer-list.controller';
import { OfferListUsecase } from '~usecases/admin/content/offer-list/get/offer-list.usecase';
import { OfferUpdateController } from '~usecases/admin/content/offer-update/put/offer-update.controller';
import { OfferUpdateUsecase } from '~usecases/admin/content/offer-update/put/offer-update.usecase';
import { PartnerCreateController } from '~usecases/admin/content/partner-create/post/partner-create.controller';
import { PartnerCreateUsecase } from '~usecases/admin/content/partner-create/post/partner-create.usecase';
import { PartnerDetailsController } from '~usecases/admin/content/partner-details/get/partner-details.controller';
import { PartnerDetailsUsecase } from '~usecases/admin/content/partner-details/get/partner-details.usecase';
import { PartnerListController } from '~usecases/admin/content/partner-list/get/partner-list.controller';
import { PartnerListUsecase } from '~usecases/admin/content/partner-list/get/partner-list.usecase';
import { PartnerUpdateController } from '~usecases/admin/content/partner-update/put/partner-update.controller';
import { PartnerUpdateUsecase } from '~usecases/admin/content/partner-update/put/partner-update.usecase';
import { SocialDefaultLabelsController } from '~usecases/admin/content/social-default-labels/get/social-default-labels.controller';
import { SocialDefaultLabelsUsecase } from '~usecases/admin/content/social-default-labels/get/social-default-labels.usecase';
import { SocialLinkCreateController } from '~usecases/admin/content/social-link-create/post/social-link-create.controller';
import { SocialLinkCreateUsecase } from '~usecases/admin/content/social-link-create/post/social-link-create.usecase';
import { SocialLinkDetailsController } from '~usecases/admin/content/social-link-details/get/social-link-details.controller';
import { SocialLinkDetailsUsecase } from '~usecases/admin/content/social-link-details/get/social-link-details.usecase';
import { SocialLinkListController } from '~usecases/admin/content/social-link-list/get/social-link-list.controller';
import { SocialLinkListUsecase } from '~usecases/admin/content/social-link-list/get/social-link-list.usecase';
import { SocialLinkUpdateController } from '~usecases/admin/content/social-link-update/put/social-link-update.controller';
import { SocialLinkUpdateUsecase } from '~usecases/admin/content/social-link-update/put/social-link-update.usecase';

/**
 * Slice S4b (content entities): /api/v1/admin/{news,gallery,offers,partners,menu-items,social-links}
 * — lists, edit forms, create / update (gallery: bulk add; menu: link targets; social links: the
 * default labels). Publish / reorder / delete are the shared list operations (~usecases/admin/entities),
 * not here. Every controller: `@Roles([UserRole.ADMIN])`. Contracts: shared/contracts/content-entities.ts.
 */
@Module({
  imports: [SiteMessagesModule, AdminCommonModule],
  controllers: [
    NewsListController,
    NewsDetailsController,
    NewsCreateController,
    NewsUpdateController,
    GalleryListController,
    GalleryDetailsController,
    GalleryCreateController,
    GalleryUpdateController,
    GalleryBulkController,
    OfferListController,
    OfferDetailsController,
    OfferCreateController,
    OfferUpdateController,
    PartnerListController,
    PartnerDetailsController,
    PartnerCreateController,
    PartnerUpdateController,
    MenuLinkTargetsController,
    MenuItemListController,
    MenuItemDetailsController,
    MenuItemCreateController,
    MenuItemUpdateController,
    SocialDefaultLabelsController,
    SocialLinkListController,
    SocialLinkDetailsController,
    SocialLinkCreateController,
    SocialLinkUpdateController,
  ],
  providers: [
    Clock,
    NewsRepository,
    NewsSlugChecker,
    NewsListUsecase,
    NewsDetailsUsecase,
    NewsCreateUsecase,
    NewsUpdateUsecase,
    GalleryRepository,
    GalleryListUsecase,
    GalleryDetailsUsecase,
    GalleryCreateUsecase,
    GalleryUpdateUsecase,
    GalleryBulkUsecase,
    OfferRepository,
    OfferListUsecase,
    OfferDetailsUsecase,
    OfferCreateUsecase,
    OfferUpdateUsecase,
    PartnerRepository,
    PartnerListUsecase,
    PartnerDetailsUsecase,
    PartnerCreateUsecase,
    PartnerUpdateUsecase,
    MenuItemRepository,
    MenuLinkTargetsRepository,
    MenuLinkTargetsUsecase,
    MenuItemListUsecase,
    MenuItemDetailsUsecase,
    MenuItemCreateUsecase,
    MenuItemUpdateUsecase,
    SocialLinkRepository,
    SocialDefaultLabelsUsecase,
    SocialLinkListUsecase,
    SocialLinkDetailsUsecase,
    SocialLinkCreateUsecase,
    SocialLinkUpdateUsecase,
  ],
})
export class AdminContentModule {}
