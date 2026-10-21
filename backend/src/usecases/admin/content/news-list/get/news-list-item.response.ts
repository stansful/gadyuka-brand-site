import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminNewsListItem, CalendarDay } from '~shared/contracts/content-entities';

import { MoscowCalendar } from '~core/content-entities/moscow-calendar';
import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';
import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';
import { NewsListRecord } from '~usecases/admin/content/common/news/news.records';

/** A row of the admin's news list. */
export class NewsListItemResponse implements AdminNewsListItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty(LocalizedTextSchema.of('Headline'))
  title: LocalizedText;

  @ApiProperty({ format: 'date', description: 'Day of the news (Moscow)' })
  date: CalendarDay;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  image: MediaRefResponse | null;

  @ApiProperty()
  published: boolean;

  static of(record: NewsListRecord): NewsListItemResponse {
    const { id, slug, title, image, published } = record;
    const date = MoscowCalendar.dayOf(record.date);
    return Object.assign(new NewsListItemResponse(), { id, slug, title, date, image, published });
  }
}
