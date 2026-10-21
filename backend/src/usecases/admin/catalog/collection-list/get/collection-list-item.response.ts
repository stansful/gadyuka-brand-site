import { ApiProperty } from '@nestjs/swagger';

import type { AdminCollectionListItem } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

/** A row of GET /admin/collections. */
export class CollectionListItemResponse implements AdminCollectionListItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'menya-zapomnyat' })
  slug: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' }, example: { ru: 'Меня запомнят' } })
  title: LocalizedText;

  @ApiProperty()
  published: boolean;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  cover: MediaRefResponse | null;

  @ApiProperty({ description: 'Products of the collection (deleted together with it)' })
  productCount: number;

  static of(item: AdminCollectionListItem): CollectionListItemResponse {
    return Object.assign(new CollectionListItemResponse(), {
      ...item,
      cover: MediaRefResponse.ofNullable(item.cover),
    });
  }
}
