import { Injectable } from '@nestjs/common';

import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';

import { RatingAboveScaleException } from './rating-above-scale.exception';
import { RatingScaleRepository } from './rating-scale.repository';
import { ReviewWrite } from './review-write.factory';

/**
 * What a review must satisfy before it is written (in this order, like the old action): a rating
 * within the CURRENT star scale, read here — the form's copy of it may be stale (400
 * ratingAboveScale), an existing avatar (400 missingMedia).
 */
@Injectable()
export class ReviewSaveRules {
  constructor(
    private readonly scales: RatingScaleRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async assertSavable(review: ReviewWrite): Promise<void> {
    if (review.rating !== null) {
      await this.assertWithinScale(review.rating);
    }
    await this.media.assertExist([review.avatarId]);
  }

  private async assertWithinScale(rating: number): Promise<void> {
    const scale = await this.scales.findScale();
    if (!scale.allows(rating)) {
      throw new RatingAboveScaleException(rating, scale.max);
    }
  }
}
