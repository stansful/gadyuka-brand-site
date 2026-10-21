import { Module } from '@nestjs/common';

import { CollectionCreateController } from '~usecases/admin/catalog/collection-create/post/collection-create.controller';
import { CollectionCreateRepository } from '~usecases/admin/catalog/collection-create/post/collection-create.repository';
import { CollectionCreateUsecase } from '~usecases/admin/catalog/collection-create/post/collection-create.usecase';
import { CollectionDetailsController } from '~usecases/admin/catalog/collection-details/get/collection-details.controller';
import { CollectionDetailsRepository } from '~usecases/admin/catalog/collection-details/get/collection-details.repository';
import { CollectionDetailsUsecase } from '~usecases/admin/catalog/collection-details/get/collection-details.usecase';
import { CollectionListController } from '~usecases/admin/catalog/collection-list/get/collection-list.controller';
import { CollectionListRepository } from '~usecases/admin/catalog/collection-list/get/collection-list.repository';
import { CollectionListUsecase } from '~usecases/admin/catalog/collection-list/get/collection-list.usecase';
import { CollectionUpdateController } from '~usecases/admin/catalog/collection-update/put/collection-update.controller';
import { CollectionUpdateRepository } from '~usecases/admin/catalog/collection-update/put/collection-update.repository';
import { CollectionUpdateUsecase } from '~usecases/admin/catalog/collection-update/put/collection-update.usecase';
import { CollectionSaveRules } from '~usecases/admin/catalog/common/collections/collection-save.rules';
import { CollectionSlugRepository } from '~usecases/admin/catalog/common/collections/collection-slug.repository';
import { ProductRowsRepository } from '~usecases/admin/catalog/common/products/product-rows.repository';
import { ProductSaveRules } from '~usecases/admin/catalog/common/products/product-save.rules';
import { RatingScaleRepository } from '~usecases/admin/catalog/common/reviews/rating-scale.repository';
import { ReviewSaveRules } from '~usecases/admin/catalog/common/reviews/review-save.rules';
import { ProductCreateController } from '~usecases/admin/catalog/product-create/post/product-create.controller';
import { ProductCreateRepository } from '~usecases/admin/catalog/product-create/post/product-create.repository';
import { ProductCreateUsecase } from '~usecases/admin/catalog/product-create/post/product-create.usecase';
import { ProductDetailsController } from '~usecases/admin/catalog/product-details/get/product-details.controller';
import { ProductDetailsRepository } from '~usecases/admin/catalog/product-details/get/product-details.repository';
import { ProductDetailsUsecase } from '~usecases/admin/catalog/product-details/get/product-details.usecase';
import { ProductListController } from '~usecases/admin/catalog/product-list/get/product-list.controller';
import { ProductListRepository } from '~usecases/admin/catalog/product-list/get/product-list.repository';
import { ProductListUsecase } from '~usecases/admin/catalog/product-list/get/product-list.usecase';
import { ProductUpdateController } from '~usecases/admin/catalog/product-update/put/product-update.controller';
import { ProductUpdateRepository } from '~usecases/admin/catalog/product-update/put/product-update.repository';
import { ProductUpdateUsecase } from '~usecases/admin/catalog/product-update/put/product-update.usecase';
import { ReviewCreateController } from '~usecases/admin/catalog/review-create/post/review-create.controller';
import { ReviewCreateRepository } from '~usecases/admin/catalog/review-create/post/review-create.repository';
import { ReviewCreateUsecase } from '~usecases/admin/catalog/review-create/post/review-create.usecase';
import { ReviewDetailsController } from '~usecases/admin/catalog/review-details/get/review-details.controller';
import { ReviewDetailsRepository } from '~usecases/admin/catalog/review-details/get/review-details.repository';
import { ReviewDetailsUsecase } from '~usecases/admin/catalog/review-details/get/review-details.usecase';
import { ReviewListController } from '~usecases/admin/catalog/review-list/get/review-list.controller';
import { ReviewListRepository } from '~usecases/admin/catalog/review-list/get/review-list.repository';
import { ReviewListUsecase } from '~usecases/admin/catalog/review-list/get/review-list.usecase';
import { ReviewScaleController } from '~usecases/admin/catalog/review-scale/get/review-scale.controller';
import { ReviewScaleUsecase } from '~usecases/admin/catalog/review-scale/get/review-scale.usecase';
import { ReviewUpdateController } from '~usecases/admin/catalog/review-update/put/review-update.controller';
import { ReviewUpdateRepository } from '~usecases/admin/catalog/review-update/put/review-update.repository';
import { ReviewUpdateUsecase } from '~usecases/admin/catalog/review-update/put/review-update.usecase';
import { SettingsDetailsController } from '~usecases/admin/catalog/settings-details/get/settings-details.controller';
import { SettingsDetailsRepository } from '~usecases/admin/catalog/settings-details/get/settings-details.repository';
import { SettingsDetailsUsecase } from '~usecases/admin/catalog/settings-details/get/settings-details.usecase';
import { SettingsUpdateController } from '~usecases/admin/catalog/settings-update/put/settings-update.controller';
import { SettingsUpdateRepository } from '~usecases/admin/catalog/settings-update/put/settings-update.repository';
import { SettingsUpdateUsecase } from '~usecases/admin/catalog/settings-update/put/settings-update.usecase';
import { AdminCommonModule } from '~usecases/admin/common/admin-common.module';

/**
 * Slice S4a (catalog): /api/v1/admin/{collections,products,reviews,settings} — CRUD of collections,
 * products (+ images), reviews (star scale check against settings.reviewRatingMax) and the site
 * settings (lowering reviewRatingMax check). Publish / reorder / delete of these rows are the shared
 * list operations (~usecases/admin/entities), not here. Every controller: `@Roles([UserRole.ADMIN])`.
 * Contracts: shared/contracts/catalog.ts.
 */
@Module({
  imports: [AdminCommonModule],
  controllers: [
    CollectionListController,
    CollectionDetailsController,
    CollectionCreateController,
    CollectionUpdateController,
    ProductListController,
    ProductDetailsController,
    ProductCreateController,
    ProductUpdateController,
    // The static /reviews/rating-scale before /reviews/:id (Fastify prefers static segments anyway).
    ReviewScaleController,
    ReviewListController,
    ReviewDetailsController,
    ReviewCreateController,
    ReviewUpdateController,
    SettingsDetailsController,
    SettingsUpdateController,
  ],
  providers: [
    CollectionSlugRepository,
    CollectionSaveRules,
    CollectionListUsecase,
    CollectionListRepository,
    CollectionDetailsUsecase,
    CollectionDetailsRepository,
    CollectionCreateUsecase,
    CollectionCreateRepository,
    CollectionUpdateUsecase,
    CollectionUpdateRepository,
    ProductRowsRepository,
    ProductSaveRules,
    ProductListUsecase,
    ProductListRepository,
    ProductDetailsUsecase,
    ProductDetailsRepository,
    ProductCreateUsecase,
    ProductCreateRepository,
    ProductUpdateUsecase,
    ProductUpdateRepository,
    RatingScaleRepository,
    ReviewSaveRules,
    ReviewScaleUsecase,
    ReviewListUsecase,
    ReviewListRepository,
    ReviewDetailsUsecase,
    ReviewDetailsRepository,
    ReviewCreateUsecase,
    ReviewCreateRepository,
    ReviewUpdateUsecase,
    ReviewUpdateRepository,
    SettingsDetailsUsecase,
    SettingsDetailsRepository,
    SettingsUpdateUsecase,
    SettingsUpdateRepository,
  ],
})
export class CatalogModule {}
