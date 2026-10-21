import { ApiPropertyOptional } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import type { AdminReviewListQuery } from '~shared/contracts/catalog';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ReviewRatingScale } from '~core/reviews/review-rating-scale';
import { ValidationMessage } from '~exception';
import { TextTransform } from '~usecases/admin/common/fields/text.transform';

/** Query of GET /admin/reviews. */
export class ReviewListDto implements AdminReviewListQuery {
  // Validated bottom-up: a whole number first, then its range.
  @ApiPropertyOptional({
    minimum: 0,
    maximum: ReviewRatingScale.LIMIT.MAX,
    description: 'Only reviews rated higher (the settings link here when the scale cannot be lowered)',
  })
  @Max(ReviewRatingScale.LIMIT.MAX, ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  @Min(0, ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  @IsInt(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  @IsOptional()
  @Transform(TextTransform.toWholeNumber)
  ratingAbove?: number;
}
