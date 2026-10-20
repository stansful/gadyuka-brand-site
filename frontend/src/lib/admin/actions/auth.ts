'use server';

import { redirect } from 'next/navigation';

import type { LoginState } from '../login-state';

import { adminLockValues } from '../admin-gate';
import { ADMIN_LOGIN_PATH, clearAdminSession, loginWithPassword } from '../auth';
import { getAdminTranslations } from '../i18n-server';

/** Only same-app admin paths are allowed as the post-login target (no open redirects). */
function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '/admin';
  if (!/^\/admin(?:[/?#]|$)/.test(value) || value.startsWith('//') || value.includes('\\')) return '/admin';
  if (value.startsWith(ADMIN_LOGIN_PATH)) return '/admin';
  return value;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const t = await getAdminTranslations('admin.auth');
  const password = formData.get('password');
  if (typeof password !== 'string' || password.length === 0) {
    return { error: t('passwordRequired') };
  }
  if (password.length > 512) return { error: t('invalidPassword') };

  const outcome = await loginWithPassword(password);
  if (!outcome.ok) {
    switch (outcome.reason) {
      // The admin is open (dev without a password, or ADMIN_ALLOW_OPEN=1): nothing to log into.
      case 'disabled':
        return redirect('/admin');
      // Locked (production without a usable password): explain instead of redirecting —
      // /admin would only send the user back here.
      case 'locked':
        return { error: t(`locked.${outcome.lockReason}`, adminLockValues(outcome.lockReason)) };
      case 'throttled': {
        const minutes = Math.max(1, Math.ceil((outcome.retryAfterMs ?? 60_000) / 60_000));
        return { error: t('throttled', { minutes }) };
      }
      case 'invalid':
        return { error: t('invalidPassword') };
    }
  }
  redirect(safeNextPath(formData.get('next')));
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  redirect(ADMIN_LOGIN_PATH);
}
