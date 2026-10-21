import { OfferButton } from '~core/content-entities/offer-button';

import { OfferLinkRequiredException } from './offer-link-required.exception';
import { OfferFields } from './offer.records';

/** A button label needs a button link (checked after the picture, like the admin did). */
export class OfferButtonChecker {
  static assertHasLink({ ctaLabel, ctaHref }: OfferFields): void {
    if (new OfferButton(ctaLabel, ctaHref).isMissingLink()) {
      throw new OfferLinkRequiredException();
    }
  }
}
