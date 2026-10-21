import { ApiProperty } from '@nestjs/swagger';

import type { AdminCollectionListItem, AdminCollectionListResponse } from '~shared/contracts/catalog';

import { CollectionListItemResponse } from './collection-list-item.response';

/** Answer of GET /admin/collections: every collection in the site's order. */
export class CollectionListResponse implements AdminCollectionListResponse {
  @ApiProperty({ type: [CollectionListItemResponse] })
  items: CollectionListItemResponse[];

  static of(items: readonly AdminCollectionListItem[]): CollectionListResponse {
    return Object.assign(new CollectionListResponse(), {
      items: items.map(item => CollectionListItemResponse.of(item)),
    });
  }
}
