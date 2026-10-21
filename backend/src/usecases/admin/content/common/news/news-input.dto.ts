import type { LocalizedText } from '~shared/contracts/common';
import type { AdminNewsInput, CalendarDay } from '~shared/contracts/content-entities';

import { NEWS_LIMITS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';

import { ContentField } from '../validation/content-field';

/** Body of POST /admin/news and PUT /admin/news/:id (port of the admin's newsInputSchema). */
export class NewsInputDto implements AdminNewsInput {
  @ContentField.slug('Address of the news item (unique among the news)')
  slug: string;

  @LocalizedTextField.required({ max: NEWS_LIMITS.TITLE, description: 'Headline (Russian required)' })
  title: LocalizedText;

  @LocalizedTextField.optional({ max: NEWS_LIMITS.EXCERPT, description: 'Short teaser' })
  excerpt: LocalizedText;

  @LocalizedTextField.optional({ max: NEWS_LIMITS.BODY, description: 'Text (paragraphs separated by a blank line)' })
  body: LocalizedText;

  @ContentField.calendarDay('Day of the news (Moscow), stored as noon Moscow time')
  date: CalendarDay;

  @ContentField.optionalMediaId('Picture (media id) or null')
  imageId: string | null;

  @ContentField.flag('Shown on the site')
  published: boolean;
}
