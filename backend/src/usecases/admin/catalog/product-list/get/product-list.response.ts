import { ApiProperty } from '@nestjs/swagger';

import type { AdminProductGroup, AdminProductListResponse } from '~shared/contracts/catalog';

import { ProductGroupResponse } from './product-group.response';

/** Answer of GET /admin/products: the products grouped by collection, both in the site's order. */
export class ProductListResponse implements AdminProductListResponse {
  @ApiProperty({ type: [ProductGroupResponse], description: 'Every collection, also one without products' })
  groups: ProductGroupResponse[];

  static of(groups: readonly AdminProductGroup[]): ProductListResponse {
    return Object.assign(new ProductListResponse(), { groups: groups.map(group => ProductGroupResponse.of(group)) });
  }
}
