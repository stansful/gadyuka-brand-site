import { Injectable } from '@nestjs/common';

import { ListPosition } from '~core/entities/list-position';
import { DatabaseService } from '~database';
import { ReviewWrite } from '~usecases/admin/catalog/common/reviews/review-write.factory';

@Injectable()
export class ReviewCreateRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Creates the review last in the list; returns its id. */
  async create(review: ReviewWrite): Promise<string> {
    const { client } = this.database;
    const last = await client.review.aggregate({ _max: { order: true } });
    const row = await client.review.create({
      data: { ...review, order: ListPosition.after(last._max.order) },
      select: { id: true },
    });
    return row.id;
  }
}
