import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';

/**
 * The public pages render at request time. With streamed metadata (Next's default for browsers and
 * DOM-capable crawlers) the response starts before a page can call notFound(), so an unknown path
 * or collection answered 200 + noindex instead of 404. Blocking metadata for every user agent keeps
 * real 404 statuses (verified live: /nope, /en/nope, /catalog/<unknown> → 404 for all of these).
 */
describe('metadata blocks for every visitor (real 404 statuses)', () => {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'curl/8.7.1',
  ];

  it.each(userAgents)('%s', userAgent => {
    const bots = nextConfig.htmlLimitedBots;
    expect(bots).toBeInstanceOf(RegExp);
    expect((bots as RegExp).test(userAgent)).toBe(true);
  });
});
