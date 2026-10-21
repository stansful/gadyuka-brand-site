import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { ReviewWrite } from '~usecases/admin/catalog/common/reviews/review-write.factory';

@Injectable()
export class ReviewUpdateRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Overwrites the review (its position stays); a missing row → 404 notFound (ApiExceptionFilter). */
  async update(id: string, review: ReviewWrite): Promise<void> {
    await this.database.client.review.update({ where: { id }, data: review, select: { id: true } });
  }
}
