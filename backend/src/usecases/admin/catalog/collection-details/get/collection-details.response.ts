import { ApiProperty } from '@nestjs/swagger';

import type { AdminCollectionDetailsResponse } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

/** Answer of GET /admin/collections/:id: the edit form of a collection. */
export class CollectionDetailsResponse implements AdminCollectionDetailsResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'menya-zapomnyat' })
  slug: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' }, example: { ru: 'Меня запомнят' } })
  title: LocalizedText;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  description: LocalizedText;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  cover: MediaRefResponse | null;

  @ApiProperty()
  published: boolean;

  @ApiProperty({ description: 'Products deleted together with the collection' })
  productCount: number;

  static of(details: AdminCollectionDetailsResponse): CollectionDetailsResponse {
    return Object.assign(new CollectionDetailsResponse(), {
      ...details,
      cover: MediaRefResponse.ofNullable(details.cover),
    });
  }
}
