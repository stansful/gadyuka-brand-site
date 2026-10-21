import { ApiProperty } from '@nestjs/swagger';

import type { AdminProductDetailsResponse } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

/** Answer of GET /admin/products/:id: the edit form of a product. */
export class ProductDetailsResponse implements AdminProductDetailsResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'hoodie-znak-white' })
  slug: string;

  @ApiProperty({ format: 'uuid' })
  collectionId: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  title: LocalizedText;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  description: LocalizedText;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  details: LocalizedText;

  @ApiProperty({ type: Number, nullable: true, description: 'Whole rubles; null = price on request' })
  price: number | null;

  @ApiProperty({ type: [MediaRefResponse], description: 'In display order' })
  images: MediaRefResponse[];

  @ApiProperty()
  published: boolean;

  static of(details: AdminProductDetailsResponse): ProductDetailsResponse {
    return Object.assign(new ProductDetailsResponse(), {
      ...details,
      images: details.images.map(image => MediaRefResponse.of(image)),
    });
  }
}
