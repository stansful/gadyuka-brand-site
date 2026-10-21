import { Injectable, Logger } from '@nestjs/common';

import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { ReviewSaveRules } from '~usecases/admin/catalog/common/reviews/review-save.rules';
import { ReviewSaveCommand, ReviewWriteFactory } from '~usecases/admin/catalog/common/reviews/review-write.factory';
import { Usecase } from '~usecases/usecase.interfaces';

import { ReviewUpdateRepository } from './review-update.repository';

export interface ReviewUpdateCommand extends ReviewSaveCommand {
  readonly id: string;
}

/** Saves the edit form of a review: rating within the current star scale, existing avatar. */
@Injectable()
export class ReviewUpdateUsecase implements Usecase<ReviewUpdateCommand, CatalogRowSavedResponse> {
  private readonly logger = new Logger(ReviewUpdateUsecase.name);

  constructor(
    private readonly rules: ReviewSaveRules,
    private readonly repository: ReviewUpdateRepository,
  ) {}

  async execute({ id, ...fields }: ReviewUpdateCommand): Promise<CatalogRowSavedResponse> {
    const review = ReviewWriteFactory.fromCommand(fields);
    await this.rules.assertSavable(review);
    await this.repository.update(id, review);
    this.logger.log('ReviewUpdateUsecase : saved', { review_id: id });
    return CatalogRowSavedResponse.of(id);
  }
}
