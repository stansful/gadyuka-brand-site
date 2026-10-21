import type { AdminOfferInput } from '~shared/contracts/content-entities';

import { MoscowCalendar } from '~core/content-entities/moscow-calendar';
import { LocalizedTextValue } from '~core/locales/localized-text-value';

import { OfferFields } from './offer.records';

/** A validated offer form → what is stored (texts normalized, the last day until 23:59:59.999 Moscow). */
export class OfferFieldsFactory {
  static fromInput(input: AdminOfferInput): OfferFields {
    return {
      title: LocalizedTextValue.normalize(input.title),
      text: LocalizedTextValue.normalize(input.text),
      badge: LocalizedTextValue.normalize(input.badge),
      ctaLabel: LocalizedTextValue.normalize(input.ctaLabel),
      ctaHref: input.ctaHref === null || input.ctaHref === '' ? null : input.ctaHref,
      validUntil: input.validUntil === null ? null : MoscowCalendar.endOfDayOf(input.validUntil),
      imageId: input.imageId,
      published: input.published,
    };
  }
}
