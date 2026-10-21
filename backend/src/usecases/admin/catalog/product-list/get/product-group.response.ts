import { ApiProperty } from '@nestjs/swagger';

import type { AdminProductGroup } from '~shared/contracts/catalog';

import { ProductGroupCollectionResponse } from './product-group-collection.response';
import { ProductListItemResponse } from './product-list-item.response';

/** One collection of GET /admin/products with its products, in the site's order. */
export class ProductGroupResponse implements AdminProductGroup {
  @ApiProperty({ type: ProductGroupCollectionResponse })
  collection: ProductGroupCollectionResponse;

  @ApiProperty({ type: [ProductListItemResponse] })
  products: ProductListItemResponse[];

  static of({ collection, products }: AdminProductGroup): ProductGroupResponse {
    return Object.assign(new ProductGroupResponse(), {
      collection: Object.assign(new ProductGroupCollectionResponse(), collection),
      products: products.map(product => ProductListItemResponse.of(product)),
    });
  }
}
