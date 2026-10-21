import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminNewsDetails, CalendarDay } from '~shared/contracts/content-entities';

import { MoscowCalendar } from '~core/content-entities/moscow-calendar';
import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';
import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

import { NewsRecord } from './news.records';

/** A news item in the edit form (GET /admin/news/:id). */
export class NewsDetailsResponse implements AdminNewsDetails {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty(LocalizedTextSchema.of('Headline'))
  title: LocalizedText;

  @ApiProperty(LocalizedTextSchema.of('Short teaser'))
  excerpt: LocalizedText;

  @ApiProperty(LocalizedTextSchema.of('Text'))
  body: LocalizedText;

  @ApiProperty({ format: 'date', description: 'Day of the news (Moscow)' })
  date: CalendarDay;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  image: MediaRefResponse | null;

  @ApiProperty()
  published: boolean;

  static of(record: NewsRecord): NewsDetailsResponse {
    const { id, slug, title, excerpt, body, image, published } = record;
    const date = MoscowCalendar.dayOf(record.date);
    return Object.assign(new NewsDetailsResponse(), { id, slug, title, excerpt, body, date, image, published });
  }
}
