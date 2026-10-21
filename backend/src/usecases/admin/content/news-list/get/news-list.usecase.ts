import { Injectable } from '@nestjs/common';

import { NewsRepository } from '~usecases/admin/content/common/news/news.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { NewsListResponse } from './news-list.response';

/** The admin's news list (newest first). */
@Injectable()
export class NewsListUsecase implements Usecase<void, NewsListResponse> {
  constructor(private readonly repository: NewsRepository) {}

  async execute(): Promise<NewsListResponse> {
    return NewsListResponse.of(await this.repository.findList());
  }
}
