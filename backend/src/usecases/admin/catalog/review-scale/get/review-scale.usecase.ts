import { Injectable } from '@nestjs/common';

import { RatingScaleRepository } from '~usecases/admin/catalog/common/reviews/rating-scale.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { ReviewScaleResponse } from './review-scale.response';

/** The current star scale for the review form (SiteSettings.reviewRatingMax). */
@Injectable()
export class ReviewScaleUsecase implements Usecase<void, ReviewScaleResponse> {
  constructor(private readonly scales: RatingScaleRepository) {}

  async execute(): Promise<ReviewScaleResponse> {
    return ReviewScaleResponse.of((await this.scales.findScale()).max);
  }
}
