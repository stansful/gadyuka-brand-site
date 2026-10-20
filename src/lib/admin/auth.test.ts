import { describe, expect, it } from 'vitest';

import { isSameOriginRequest } from './auth';

const post = (headers: Record<string, string>): Request =>
  new Request('http://localhost:3000/admin/api/media', { method: 'POST', headers });

describe('isSameOriginRequest (CSRF guard for admin route handlers)', () => {
  it('accepts same-origin browser requests', () => {
    expect(
      isSameOriginRequest(
        post({ host: 'localhost:3000', origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' }),
      ),
    ).toBe(true);
  });

  it('accepts the forwarded host behind a reverse proxy', () => {
    expect(
      isSameOriginRequest(post({ host: 'app:3000', 'x-forwarded-host': 'gadyuka.ru', origin: 'https://gadyuka.ru' })),
    ).toBe(true);
  });

  it('rejects cross-site requests', () => {
    expect(isSameOriginRequest(post({ host: 'localhost:3000', origin: 'https://evil.example' }))).toBe(false);
    expect(isSameOriginRequest(post({ host: 'localhost:3000', 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isSameOriginRequest(post({ host: 'localhost:3000', origin: 'null' }))).toBe(false);
  });

  it('allows non-browser clients without Origin (they carry no ambient cookies cross-site)', () => {
    expect(isSameOriginRequest(post({ host: 'localhost:3000' }))).toBe(true);
  });
});
