import { ApiProperty } from '@nestjs/swagger';

import type { AdminNewsListResponse } from '~shared/contracts/content-entities';

import { NewsListRecord } from '~usecases/admin/content/common/news/news.records';

import { NewsListItemResponse } from './news-list-item.response';

/** GET /admin/news: every news item, newest first. */
export class NewsListResponse implements AdminNewsListResponse {
  @ApiProperty({ type: [NewsListItemResponse] })
  items: NewsListItemResponse[];

  static of(records: readonly NewsListRecord[]): NewsListResponse {
    return Object.assign(new NewsListResponse(), { items: records.map(record => NewsListItemResponse.of(record)) });
  }
}
