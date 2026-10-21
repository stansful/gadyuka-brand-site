import { ApiProperty } from '@nestjs/swagger';

import type { AdminProductGroupCollection } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

/** The collection heading a group of GET /admin/products. */
export class ProductGroupCollectionResponse implements AdminProductGroupCollection {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'menya-zapomnyat' })
  slug: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  title: LocalizedText;

  @ApiProperty()
  published: boolean;
}
