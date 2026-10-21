import { ApiProperty } from '@nestjs/swagger';

import type { AdminReviewListItem, AdminReviewListResponse } from '~shared/contracts/catalog';

import { ReviewListItemResponse } from './review-list-item.response';

/** Answer of GET /admin/reviews: the reviews in the site's order and the current star scale. */
export class ReviewListResponse implements AdminReviewListResponse {
  @ApiProperty({ description: 'The current star scale (SiteSettings.reviewRatingMax)' })
  ratingMax: number;

  @ApiProperty({ type: [ReviewListItemResponse] })
  items: ReviewListItemResponse[];

  static of(ratingMax: number, items: readonly AdminReviewListItem[]): ReviewListResponse {
    return Object.assign(new ReviewListResponse(), {
      ratingMax,
      items: items.map(item => ReviewListItemResponse.of(item)),
    });
  }
}
