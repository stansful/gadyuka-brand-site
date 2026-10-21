import { Injectable } from '@nestjs/common';

import { DEFAULT_LOCALE } from '~core/locales/locale.enum';
import { MessageCatalog, MessageFormatter } from '~module/messages';

/**
 * The Russian admin names of the site texts (admin.siteTexts.labels.<key> in shared/messages/admin/ru.json),
 * formatted like the admin shows them (ICU: an escaped '{title}' shows as {title}). The search matches
 * them; the API itself never answers with them (the admin translates the keys).
 */
@Injectable()
export class SiteTextLabels {
  private static readonly LABELS_PREFIX = 'admin.siteTexts.labels.';

  constructor(
    private readonly catalog: MessageCatalog,
    private readonly formatter: MessageFormatter,
  ) {}

  /** The label of a text; a text without one is named by its key without the namespace ("advantages.0.title"). */
  labelOf(key: string): string {
    const template = this.catalog.findAdminMessage(`${SiteTextLabels.LABELS_PREFIX}${key}`);
    if (template === undefined) {
      return key.slice(key.indexOf('.') + 1);
    }
    return this.formatter.format(template, DEFAULT_LOCALE);
  }
}
