import { Injectable } from '@nestjs/common';

import { ContentEntityNotFoundException } from '~usecases/admin/content/common/exceptions/content-entity-not-found.exception';
import { NewsDetailsResponse } from '~usecases/admin/content/common/news/news-details.response';
import { NewsRepository } from '~usecases/admin/content/common/news/news.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface NewsDetailsQuery {
  readonly id: string;
}

/** One news item for the edit form. */
@Injectable()
export class NewsDetailsUsecase implements Usecase<NewsDetailsQuery, NewsDetailsResponse> {
  constructor(private readonly repository: NewsRepository) {}

  async execute({ id }: NewsDetailsQuery): Promise<NewsDetailsResponse> {
    const record = await this.repository.findById(id);
    if (record === undefined) {
      throw new ContentEntityNotFoundException();
    }
    return NewsDetailsResponse.of(record);
  }
}
