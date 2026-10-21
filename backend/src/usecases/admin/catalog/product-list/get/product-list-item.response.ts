import { ApiProperty } from '@nestjs/swagger';

import type { AdminProductListItem } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

/** A product row of GET /admin/products. */
export class ProductListItemResponse implements AdminProductListItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'hoodie-znak-white' })
  slug: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' }, example: { ru: 'Худи «Знак», белое' } })
  title: LocalizedText;

  @ApiProperty({ type: Number, nullable: true, description: 'Whole rubles; null = price on request' })
  price: number | null;

  @ApiProperty()
  published: boolean;

  @ApiProperty({ type: MediaRefResponse, nullable: true, description: 'The first photo' })
  cover: MediaRefResponse | null;

  @ApiProperty()
  imageCount: number;

  static of(item: AdminProductListItem): ProductListItemResponse {
    return Object.assign(new ProductListItemResponse(), { ...item, cover: MediaRefResponse.ofNullable(item.cover) });
  }
}
