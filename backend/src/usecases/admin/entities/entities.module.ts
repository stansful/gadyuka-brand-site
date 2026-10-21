import { Module } from '@nestjs/common';

import { EntityRowsRegistry } from '~usecases/admin/entities/common/entity-rows.registry';
import { EntityDeleteController } from '~usecases/admin/entities/entity-delete/delete/entity-delete.controller';
import { EntityDeleteUsecase } from '~usecases/admin/entities/entity-delete/delete/entity-delete.usecase';
import { EntityOrderController } from '~usecases/admin/entities/entity-order/post/entity-order.controller';
import { EntityOrderUsecase } from '~usecases/admin/entities/entity-order/post/entity-order.usecase';
import { EntityPublishedController } from '~usecases/admin/entities/entity-published/patch/entity-published.controller';
import { EntityPublishedUsecase } from '~usecases/admin/entities/entity-published/patch/entity-published.usecase';

/**
 * Shared list operations of the admin lists (/api/v1/admin/entities/*): publish toggle, drag & drop
 * order, delete — for collections, products, reviews, news (publish / delete only), gallery items,
 * offers, partners, menu items and social links (shared/contracts/entities.ts). Step 4A foundation.
 */
@Module({
  controllers: [EntityPublishedController, EntityOrderController, EntityDeleteController],
  providers: [EntityRowsRegistry, EntityPublishedUsecase, EntityOrderUsecase, EntityDeleteUsecase],
})
export class AdminEntitiesModule {}
