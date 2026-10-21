import { Injectable } from '@nestjs/common';

import { EntityNotFoundException } from '~usecases/admin/entities/common/entity-not-found.exception';
import { Usecase } from '~usecases/usecase.interfaces';

import { ReviewDetailsRepository } from './review-details.repository';
import { ReviewDetailsResponse } from './review-details.response';

export interface ReviewDetailsQuery {
  readonly id: string;
}

/** One review for its edit form (404 notFound when it does not exist). */
@Injectable()
export class ReviewDetailsUsecase implements Usecase<ReviewDetailsQuery, ReviewDetailsResponse> {
  constructor(private readonly repository: ReviewDetailsRepository) {}

  async execute({ id }: ReviewDetailsQuery): Promise<ReviewDetailsResponse> {
    const details = await this.repository.findById(id);
    if (details === null) {
      throw new EntityNotFoundException();
    }
    return ReviewDetailsResponse.of(details);
  }
}
