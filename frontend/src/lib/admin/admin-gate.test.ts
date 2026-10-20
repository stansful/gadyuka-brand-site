import { describe, expect, it } from 'vitest';

import { adminTestTranslator } from '../../../test/admin-intl';
import { adminLockValues, resolveAdminGate, type AdminLockReason } from './admin-gate';

const STRONG = 'x'.repeat(16);

describe('resolveAdminGate', () => {
  it('dev/test without a password: open', () => {
    expect(resolveAdminGate({ NODE_ENV: 'development', ADMIN_PASSWORD: '' })).toEqual({ kind: 'open' });
    expect(resolveAdminGate({ NODE_ENV: 'test' })).toEqual({ kind: 'open' });
  });

  it('production without a password fails closed unless ADMIN_ALLOW_OPEN=1', () => {
    expect(resolveAdminGate({ NODE_ENV: 'production', ADMIN_PASSWORD: '' })).toEqual({
      kind: 'locked',
      reason: 'missing-password',
    });
    expect(resolveAdminGate({ NODE_ENV: 'production', ADMIN_ALLOW_OPEN: '0' })).toMatchObject({ kind: 'locked' });
    expect(resolveAdminGate({ NODE_ENV: 'production', ADMIN_ALLOW_OPEN: '1' })).toEqual({ kind: 'open' });
    expect(resolveAdminGate({ NODE_ENV: 'production', ADMIN_ALLOW_OPEN: ' true ' })).toEqual({ kind: 'open' });
  });

  it('password mode; production requires at least 16 characters', () => {
    expect(resolveAdminGate({ NODE_ENV: 'production', ADMIN_PASSWORD: 'short' })).toEqual({
      kind: 'locked',
      reason: 'weak-password',
    });
    expect(resolveAdminGate({ NODE_ENV: 'production', ADMIN_PASSWORD: STRONG })).toEqual({
      kind: 'password',
      password: STRONG,
      sessionSecret: '',
    });
    // dev: any length (tests, local work)
    expect(resolveAdminGate({ NODE_ENV: 'development', ADMIN_PASSWORD: 'dev' })).toMatchObject({ kind: 'password' });
  });

  it('a password always wins over ADMIN_ALLOW_OPEN', () => {
    expect(resolveAdminGate({ NODE_ENV: 'production', ADMIN_PASSWORD: STRONG, ADMIN_ALLOW_OPEN: '1' })).toMatchObject({
      kind: 'password',
    });
  });

  it('rejects a too short ADMIN_SESSION_SECRET in production', () => {
    expect(resolveAdminGate({ NODE_ENV: 'production', ADMIN_PASSWORD: STRONG, ADMIN_SESSION_SECRET: 'tiny' })).toEqual({
      kind: 'locked',
      reason: 'weak-session-secret',
    });
    expect(
      resolveAdminGate({ NODE_ENV: 'production', ADMIN_PASSWORD: STRONG, ADMIN_SESSION_SECRET: 's'.repeat(64) }),
    ).toEqual({ kind: 'password', password: STRONG, sessionSecret: 's'.repeat(64) });
  });

  it('has an explanation for every lock reason (admin.auth.locked)', () => {
    const t = adminTestTranslator('admin.auth');
    const reasons: AdminLockReason[] = ['missing-password', 'weak-password', 'weak-session-secret'];
    for (const reason of reasons) expect(t(`locked.${reason}`, adminLockValues(reason))).toMatch(/^Админка закрыта/);
    expect(t('locked.weak-password', adminLockValues('weak-password'))).toMatch(/не меньше 16 символов/);
    expect(t('locked.weak-session-secret', adminLockValues('weak-session-secret'))).toMatch(/короче 32 символов/);
  });
});
