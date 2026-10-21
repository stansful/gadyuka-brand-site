import { ApiProperty } from '@nestjs/swagger';

import type { AdminReviewListItem } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

/** A row of GET /admin/reviews. */
export class ReviewListItemResponse implements AdminReviewListItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Сергей' })
  author: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' }, example: { ru: 'покупатель' } })
  role: LocalizedText;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  text: LocalizedText;

  @ApiProperty({ type: Number, nullable: true, description: 'May exceed ratingMax (the scale was lowered later)' })
  rating: number | null;

  @ApiProperty()
  published: boolean;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  avatar: MediaRefResponse | null;

  static of(item: AdminReviewListItem): ReviewListItemResponse {
    return Object.assign(new ReviewListItemResponse(), { ...item, avatar: MediaRefResponse.ofNullable(item.avatar) });
  }
}
