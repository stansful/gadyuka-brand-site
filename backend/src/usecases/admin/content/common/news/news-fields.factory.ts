import type { AdminNewsInput } from '~shared/contracts/content-entities';

import { MoscowCalendar } from '~core/content-entities/moscow-calendar';
import { LocalizedTextValue } from '~core/locales/localized-text-value';

import { NewsFields } from './news.records';

/** A validated news form → what is stored (texts normalized, the day as noon Moscow time). */
export class NewsFieldsFactory {
  static fromInput(input: AdminNewsInput): NewsFields {
    return {
      slug: input.slug,
      title: LocalizedTextValue.normalize(input.title),
      excerpt: LocalizedTextValue.normalize(input.excerpt),
      body: LocalizedTextValue.normalize(input.body),
      date: MoscowCalendar.noonOf(input.date),
      imageId: input.imageId,
      published: input.published,
    };
  }
}
