import 'server-only';
import { createHash, scrypt, timingSafeEqual } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

/**
 * Admin session token: a short HS256 JWT (jose) stored in an httpOnly cookie.
 *
 * Signing key = scrypt(ADMIN_PASSWORD, salt = "gadyuka-admin-session:v2:" + ADMIN_SESSION_SECRET).
 *  - scrypt makes offline guessing of the password from a leaked cookie expensive
 *    (~16 MB and tens of ms per guess instead of one SHA-256);
 *  - with ADMIN_SESSION_SECRET set (recommended in production, `openssl rand -hex 32`)
 *    a leaked cookie reveals nothing without the server secret;
 *  - changing the password OR the secret invalidates every existing session at once
 *    (that is the "log everyone out" switch — there is no server-side session store).
 * Derived keys are memoized per (password, secret), so the cost is paid once per process.
 * Pure functions (no next/headers) so they can be unit-tested.
 */

/** 3 days. */
export const ADMIN_SESSION_TTL_SECONDS = 3 * 24 * 60 * 60;

const ISSUER = 'gadyuka-admin';
const AUDIENCE = 'gadyuka-admin';
const SUBJECT = 'admin';
/** Anything longer is not one of our tokens — reject before parsing. */
const MAX_TOKEN_LENGTH = 2048;

const KEY_SALT_PREFIX = 'gadyuka-admin-session:v2:';
const SCRYPT_PARAMS = { N: 2 ** 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LENGTH = 32;
const MAX_CACHED_KEYS = 8;

const keyCache = new Map<string, Promise<Uint8Array>>();

function cacheKey(password: string, secret: string): string {
  return createHash('sha256').update(`${secret}\u0000${password}`, 'utf8').digest('hex');
}

/** 32-byte HMAC key derived from the admin password (+ optional server secret). Memoized. */
export function deriveSessionKey(password: string, secret: string = ''): Promise<Uint8Array> {
  const id = cacheKey(password, secret);
  const cached = keyCache.get(id);
  if (cached) return cached;
  const derived = new Promise<Uint8Array>((resolve, reject) => {
    scrypt(password, `${KEY_SALT_PREFIX}${secret}`, KEY_LENGTH, SCRYPT_PARAMS, (error, key) => {
      if (error) reject(error);
      else resolve(new Uint8Array(key));
    });
  });
  if (keyCache.size >= MAX_CACHED_KEYS) keyCache.clear();
  keyCache.set(id, derived);
  derived.catch(() => keyCache.delete(id));
  return derived;
}

export async function signAdminSession(key: Uint8Array, nowMs: number = Date.now()): Promise<string> {
  const issuedAt = Math.floor(nowMs / 1000);
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(SUBJECT)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ADMIN_SESSION_TTL_SECONDS)
    .sign(key);
}

/** True only for an unexpired token signed with `key`. Never throws. */
export async function verifyAdminSession(token: string, key: Uint8Array, nowMs?: number): Promise<boolean> {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return false;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: SUBJECT,
      ...(nowMs === undefined ? {} : { currentDate: new Date(nowMs) }),
    });
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison. Both sides are hashed first, so the
 * comparison time does not depend on the length or content of either value.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a, 'utf8').digest();
  const right = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(left, right);
}
