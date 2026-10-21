import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { OfferButton } from './offer-button';
import { OfferValidity } from './offer-validity';
import { SocialProfileUrl } from './social-profile-url';

describe('content entity rules', () => {
  it('OfferValidity: valid through the last millisecond of validUntil, forever without it', () => {
    const until = new Date('2026-10-31T20:59:59.999Z');
    strictEqual(new OfferValidity(until).isExpiredAt(new Date('2026-10-31T20:59:59.999Z')), false);
    strictEqual(new OfferValidity(until).isExpiredAt(new Date('2026-10-31T21:00:00.000Z')), true);
    strictEqual(new OfferValidity(null).isExpiredAt(new Date('2100-01-01T00:00:00.000Z')), false);
  });

  it('OfferButton: a label in any language needs a link', () => {
    strictEqual(new OfferButton({ en: 'Buy' }, null).isMissingLink(), true);
    strictEqual(new OfferButton({ ru: 'Купить' }, '#contacts').isMissingLink(), false);
    strictEqual(new OfferButton({}, null).isMissingLink(), false);
    strictEqual(new OfferButton({ ru: ' ' }, null).isMissingLink(), false);
  });

  it('SocialProfileUrl: a link without a profile path is a placeholder', () => {
    for (const url of ['https://t.me/', 'https://t.me', 'https://vk.com///']) {
      strictEqual(SocialProfileUrl.isBare(url), true, url);
    }
    for (const url of ['https://t.me/gadyuka', 'not a url']) {
      strictEqual(SocialProfileUrl.isBare(url), false, url);
    }
  });
});
