import { Injectable, Logger } from '@nestjs/common';

import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { ReviewSaveRules } from '~usecases/admin/catalog/common/reviews/review-save.rules';
import { ReviewSaveCommand, ReviewWriteFactory } from '~usecases/admin/catalog/common/reviews/review-write.factory';
import { Usecase } from '~usecases/usecase.interfaces';

import { ReviewCreateRepository } from './review-create.repository';

/** Adds a review (last in the list): rating within the current star scale, existing avatar. */
@Injectable()
export class ReviewCreateUsecase implements Usecase<ReviewSaveCommand, CatalogRowSavedResponse> {
  private readonly logger = new Logger(ReviewCreateUsecase.name);

  constructor(
    private readonly rules: ReviewSaveRules,
    private readonly repository: ReviewCreateRepository,
  ) {}

  async execute(command: ReviewSaveCommand): Promise<CatalogRowSavedResponse> {
    const review = ReviewWriteFactory.fromCommand(command);
    await this.rules.assertSavable(review);
    const id = await this.repository.create(review);
    this.logger.log('ReviewCreateUsecase : created', { review_id: id });
    return CatalogRowSavedResponse.of(id);
  }
}
