import { Injectable } from '@nestjs/common';

import { EntityKind, OrderableEntityKind } from '~core/entities/entity-kind.enum';
import { DatabaseService } from '~database';

import { OrderableRows, PublishableRows } from './entity-rows.interfaces';
import { CollectionRows } from './rows/collection.rows';
import { GalleryRows } from './rows/gallery.rows';
import { MenuItemRows } from './rows/menu-item.rows';
import { NewsRows } from './rows/news.rows';
import { OfferRows } from './rows/offer.rows';
import { PartnerRows } from './rows/partner.rows';
import { ProductRows } from './rows/product.rows';
import { ReviewRows } from './rows/review.rows';
import { SocialLinkRows } from './rows/social-link.rows';

/**
 * The data access of every entity of the shared list operations, by kind (strategy maps: a new
 * EntityKind fails compilation until its rows class is added here).
 */
@Injectable()
export class EntityRowsRegistry {
  private readonly orderable: Readonly<Record<OrderableEntityKind, OrderableRows>>;
  private readonly publishable: Readonly<Record<EntityKind, PublishableRows>>;

  constructor(database: DatabaseService) {
    this.orderable = EntityRowsRegistry.buildOrderable(database);
    this.publishable = { ...this.orderable, [EntityKind.NEWS]: new NewsRows(database) };
  }

  publishableRowsOf(kind: EntityKind): PublishableRows {
    return this.publishable[kind];
  }

  orderableRowsOf(kind: OrderableEntityKind): OrderableRows {
    return this.orderable[kind];
  }

  private static buildOrderable(database: DatabaseService): Record<OrderableEntityKind, OrderableRows> {
    return {
      [EntityKind.COLLECTION]: new CollectionRows(database),
      [EntityKind.PRODUCT]: new ProductRows(database),
      [EntityKind.REVIEW]: new ReviewRows(database),
      [EntityKind.GALLERY]: new GalleryRows(database),
      [EntityKind.OFFER]: new OfferRows(database),
      [EntityKind.PARTNER]: new PartnerRows(database),
      [EntityKind.MENU_ITEM]: new MenuItemRows(database),
      [EntityKind.SOCIAL_LINK]: new SocialLinkRows(database),
    };
  }
}
