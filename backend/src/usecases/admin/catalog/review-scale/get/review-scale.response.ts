import { ApiProperty } from '@nestjs/swagger';

import type { AdminReviewRatingScaleResponse } from '~shared/contracts/catalog';

import { ReviewRatingScale } from '~core/reviews/review-rating-scale';

/** Answer of GET /admin/reviews/rating-scale. */
export class ReviewScaleResponse implements AdminReviewRatingScaleResponse {
  @ApiProperty({
    minimum: ReviewRatingScale.LIMIT.MIN,
    maximum: ReviewRatingScale.LIMIT.MAX,
    description: `Stars of a review rating (${ReviewRatingScale.DEFAULT_MAX} before the first save)`,
  })
  max: number;

  static of(max: number): ReviewScaleResponse {
    return Object.assign(new ReviewScaleResponse(), { max });
  }
}
