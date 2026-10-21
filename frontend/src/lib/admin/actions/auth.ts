'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { describeAdminFailure, translateAdminMessage } from '@/lib/api/admin-messages';
import { describeFailure } from '@/lib/api/api-result';
import { signIn, signOut } from '@/lib/api/auth';
import {
  ADMIN_LOGIN_PATH,
  ADMIN_REFRESH_COOKIE,
  expiredSessionCookies,
  safeAdminPath,
  sessionCookies,
} from '@/lib/api/session-cookies';
import { getVisitor } from '@/lib/api/visitor';

import type { LoginState } from '../login-state';

/** Longest login / password sent (the backend refuses longer ones too). */
const MAX_LOGIN_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 256;

/**
 * Sign-in: login + password → POST /api/v1/auth/login (with the visitor's IP: the backend throttles
 * 5 attempts / min per IP + login) → the token pair as httpOnly cookies → the requested admin page.
 */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const login = stringField(formData, 'login').trim();
  const password = stringField(formData, 'password');
  const fieldErrors = await missingFields(login, password);
  if (fieldErrors.login || fieldErrors.password) return { error: null, fieldErrors, login };
  if (login.length > MAX_LOGIN_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return { error: await translateAdminMessage({ key: 'admin.auth.invalidCredentials' }), fieldErrors: {}, login };
  }

  const result = await signIn({ login, password }, await getVisitor());
  if (!result.ok) {
    const failure = result.failure;
    if (failure.kind === 'unavailable') console.error(`[admin] sign-in: ${describeFailure(failure)}`);
    if (failure.kind === 'validation') {
      const { fieldErrors: fields = {} } = await describeAdminFailure(failure);
      return { error: null, fieldErrors: { login: fields.login, password: fields.password }, login };
    }
    const message = failure.kind === 'domain' ? failure.message : { key: 'admin.errors.actionFailed' };
    return { error: await translateAdminMessage(message), fieldErrors: {}, login };
  }
  const cookieStore = await cookies();
  for (const cookie of sessionCookies(result.data)) cookieStore.set(cookie.name, cookie.value, cookie.options);
  redirect(safeAdminPath(formData.get('next')));
}

/** Sign-out: ends the session in the backend (best effort) and deletes the cookies. */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(ADMIN_REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const result = await signOut(refreshToken);
    if (!result.ok) console.error(`[admin] sign-out: ${describeFailure(result.failure)}`);
  }
  for (const cookie of expiredSessionCookies()) cookieStore.set(cookie.name, cookie.value, cookie.options);
  redirect(ADMIN_LOGIN_PATH);
}

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

async function missingFields(login: string, password: string): Promise<LoginState['fieldErrors']> {
  return {
    ...(login === '' ? { login: await translateAdminMessage({ key: 'admin.auth.loginRequired' }) } : {}),
    ...(password === '' ? { password: await translateAdminMessage({ key: 'admin.auth.passwordRequired' }) } : {}),
  };
}
