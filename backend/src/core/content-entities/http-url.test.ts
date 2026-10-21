import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { HttpUrl } from './http-url';

describe('HttpUrl (rules of z.url({ protocol: /^https?$/ }))', () => {
  it('accepts http(s) links, also with spaces around and any case of the scheme', () => {
    for (const url of [
      'https://t.me/gadyuka',
      'http://example.ru',
      ' https://example.ru/path?q=1 ',
      'HTTPS://Example.ru',
    ]) {
      strictEqual(HttpUrl.isValid(url), true, url);
    }
  });

  it('refuses other schemes, scheme-less and unparseable links', () => {
    for (const url of [
      'ftp://x',
      'javascript:alert(1)',
      'example.ru',
      '//example.ru',
      'https:/example.ru',
      'https://',
      '',
    ]) {
      strictEqual(HttpUrl.isValid(url), false, url);
    }
  });

  it('stores the trimmed link without tabs and line breaks', () => {
    strictEqual(HttpUrl.normalize('  https://exa\nmple.ru/\tpath  '), 'https://example.ru/path');
  });
});
