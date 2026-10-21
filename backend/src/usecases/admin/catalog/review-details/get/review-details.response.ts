import { ApiProperty } from '@nestjs/swagger';

import type { AdminReviewDetailsResponse } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

/** Answer of GET /admin/reviews/:id: the edit form of a review. */
export class ReviewDetailsResponse implements AdminReviewDetailsResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Сергей' })
  author: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  role: LocalizedText;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  text: LocalizedText;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  avatar: MediaRefResponse | null;

  @ApiProperty({ type: Number, nullable: true })
  rating: number | null;

  @ApiProperty()
  published: boolean;

  static of(details: AdminReviewDetailsResponse): ReviewDetailsResponse {
    return Object.assign(new ReviewDetailsResponse(), {
      ...details,
      avatar: MediaRefResponse.ofNullable(details.avatar),
    });
  }
}
