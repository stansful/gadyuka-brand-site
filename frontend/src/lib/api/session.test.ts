import { describe, expect, it } from 'vitest';

import { jwtExpiringAt, testTokens } from '../../../test/session-tokens';
import { RefreshSingleFlight, type RefreshOutcome } from './refresh-single-flight';
import {
  ACCESS_TOKEN_EXPIRY_MARGIN_MS,
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  accessTokenExpiry,
  expiredSessionCookies,
  isAccessTokenFresh,
  safeAdminPath,
  sessionCookies,
} from './session-cookies';

const NOW = Date.parse('2026-10-21T12:00:00.000Z');

const TOKENS = testTokens(NOW);

describe('session cookies', () => {
  it('stores the pair as httpOnly, SameSite=Lax, path / cookies living until the backend expiries', () => {
    expect(sessionCookies(TOKENS, NOW)).toEqual([
      {
        name: ADMIN_ACCESS_COOKIE,
        value: TOKENS.accessToken,
        options: { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 900 },
      },
      {
        name: ADMIN_REFRESH_COOKIE,
        value: TOKENS.refreshToken,
        options: { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 2_592_000 },
      },
    ]);
    expect(expiredSessionCookies().map(cookie => cookie.options.maxAge)).toEqual([0, 0]);
  });

  it('reads the exp claim to decide whether the access token is still usable', () => {
    expect(accessTokenExpiry(jwtExpiringAt(NOW))).toBe(NOW);
    expect(isAccessTokenFresh(jwtExpiringAt(NOW + 60_000), NOW)).toBe(true);
    expect(isAccessTokenFresh(jwtExpiringAt(NOW + ACCESS_TOKEN_EXPIRY_MARGIN_MS - 1000), NOW)).toBe(false);
    expect(isAccessTokenFresh('not-a-jwt', NOW)).toBe(false);
    expect(isAccessTokenFresh('a.bm90LWpzb24.c', NOW)).toBe(false);
  });

  it('keeps post-login targets inside the admin', () => {
    expect(safeAdminPath('/admin/leads?type=CONTACT')).toBe('/admin/leads?type=CONTACT');
    for (const unsafe of ['https://evil.example', '//evil.example', '/adminx', '/admin/login', '/\\evil', undefined]) {
      expect(safeAdminPath(unsafe)).toBe('/admin');
    }
  });
});

describe('RefreshSingleFlight', () => {
  function deferred(): { promise: Promise<RefreshOutcome>; resolve: (outcome: RefreshOutcome) => void } {
    let resolve: (outcome: RefreshOutcome) => void = () => undefined;
    const promise = new Promise<RefreshOutcome>(done => {
      resolve = done;
    });
    return { promise, resolve };
  }

  it('refreshes once for concurrent and late requests with the same token', async () => {
    let now = NOW;
    const pending = deferred();
    const calls: string[] = [];
    const flight = new RefreshSingleFlight(
      async token => {
        calls.push(token);
        return pending.promise;
      },
      { now: () => now },
    );
    const first = flight.run('t1');
    const second = flight.run('t1');
    pending.resolve({ kind: 'refreshed', tokens: TOKENS });
    expect(await first).toEqual(await second);
    now += 20_000;
    expect(await flight.run('t1')).toEqual({ kind: 'refreshed', tokens: TOKENS });
    expect(calls).toEqual(['t1']);
  });

  it('forgets an outcome after the reuse window, and never keeps "unavailable"', async () => {
    let now = NOW;
    let outcome: RefreshOutcome = { kind: 'unavailable' };
    let calls = 0;
    const flight = new RefreshSingleFlight(
      async () => {
        calls += 1;
        return outcome;
      },
      { now: () => now },
    );
    await flight.run('t2');
    await Promise.resolve();
    outcome = { kind: 'rejected' };
    expect(await flight.run('t2')).toEqual({ kind: 'rejected' });
    now += 31_000;
    await flight.run('t2');
    expect(calls).toBe(3);
  });

  it('treats a throwing refresh as unavailable and bounds the remembered tokens', async () => {
    const flight = new RefreshSingleFlight(
      async token => {
        if (token === 'boom') throw new Error('network');
        return { kind: 'rejected' };
      },
      { maxEntries: 2 },
    );
    expect(await flight.run('boom')).toEqual({ kind: 'unavailable' });
    await Promise.all([flight.run('a'), flight.run('b'), flight.run('c')]);
    expect(flight.size).toBeLessThanOrEqual(2);
  });
});
