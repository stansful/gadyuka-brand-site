import { Injectable } from '@nestjs/common';

import type { AdminReviewListItem } from '~shared/contracts/catalog';

import { RatingScaleRepository } from '~usecases/admin/catalog/common/reviews/rating-scale.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { ReviewListRepository } from './review-list.repository';
import { ReviewListResponse } from './review-list.response';

export interface ReviewListQuery {
  /** Only reviews rated higher than this */
  readonly ratingAbove?: number;
}

/** The reviews of the admin list (or those rated above a value) with the current star scale. */
@Injectable()
export class ReviewListUsecase implements Usecase<ReviewListQuery, ReviewListResponse> {
  constructor(
    private readonly repository: ReviewListRepository,
    private readonly scales: RatingScaleRepository,
  ) {}

  async execute({ ratingAbove }: ReviewListQuery): Promise<ReviewListResponse> {
    const [scale, items] = await Promise.all([this.scales.findScale(), this.findItems(ratingAbove)]);
    return ReviewListResponse.of(scale.max, items);
  }

  private findItems(ratingAbove: number | undefined): Promise<AdminReviewListItem[]> {
    return ratingAbove === undefined ? this.repository.findAll() : this.repository.findRatedAbove(ratingAbove);
  }
}
