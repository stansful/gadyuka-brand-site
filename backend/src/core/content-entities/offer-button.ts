import type { LocalizedText } from '~shared/contracts/common';

import { LocaleMap } from '~core/locales/locale-map';
import { LocalizedTextValue } from '~core/locales/localized-text-value';

/** The optional button of a special offer: a label (per locale) and its link. */
export class OfferButton {
  constructor(
    private readonly label: Readonly<LocalizedText>,
    private readonly href: string | null,
  ) {}

  /** A label in some language but no link: the button would lead nowhere. */
  isMissingLink(): boolean {
    const hasLabel = LocaleMap.LOCALES.some(locale => LocalizedTextValue.hasText(this.label, locale));
    return hasLabel && (this.href === null || this.href === '');
  }
}
