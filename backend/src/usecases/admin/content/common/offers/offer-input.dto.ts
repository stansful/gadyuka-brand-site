import type { LocalizedText } from '~shared/contracts/common';
import type { AdminOfferInput, CalendarDay } from '~shared/contracts/content-entities';

import { OFFER_LIMITS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';

import { ContentField } from '../validation/content-field';

/** Body of POST /admin/offers and PUT /admin/offers/:id (port of the admin's offerInputSchema). */
export class OfferInputDto implements AdminOfferInput {
  @LocalizedTextField.required({ max: OFFER_LIMITS.TITLE, description: 'Headline (Russian required)' })
  title: LocalizedText;

  @LocalizedTextField.optional({ max: OFFER_LIMITS.TEXT, description: 'Text' })
  text: LocalizedText;

  @LocalizedTextField.optional({ max: OFFER_LIMITS.BADGE, description: 'Badge («−15%»); empty = no badge' })
  badge: LocalizedText;

  @LocalizedTextField.optional({ max: OFFER_LIMITS.CTA_LABEL, description: 'Button label; empty = no button' })
  ctaLabel: LocalizedText;

  @ContentField.optionalSiteHref('Button link (https://…, /path, #anchor, mailto:, tel:) or null')
  ctaHref: string | null;

  @ContentField.optionalCalendarDay('Last day of the offer (inclusive, Moscow) or null = no end')
  validUntil: CalendarDay | null;

  @ContentField.optionalMediaId('Picture (media id) or null')
  imageId: string | null;

  @ContentField.flag('Shown on the site')
  published: boolean;
}
