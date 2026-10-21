import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { SiteHref } from './site-href';

describe('SiteHref (links the admin puts on the site)', () => {
  it('accepts anchors, site paths, http(s), mailto: and tel:', () => {
    for (const href of [
      '#contacts',
      '#',
      '/en#tailoring',
      '/catalog/menya-zapomnyat',
      'https://t.me/gadyuka',
      'mailto:hi@example.ru',
      'tel:+7 (900) 000-00-00',
      '  #contacts  ',
    ]) {
      strictEqual(SiteHref.isValid(href), true, href);
    }
  });

  it('refuses javascript:, protocol-relative, bare words and over-long links', () => {
    const long = `https://example.ru/${'a'.repeat(SiteHref.MAX_LENGTH)}`;
    for (const href of ['javascript:alert(1)', '//evil.example', 'catalog', 'data:text/html,x', '#a b', '', long]) {
      strictEqual(SiteHref.isValid(href), false, href);
    }
  });
});
