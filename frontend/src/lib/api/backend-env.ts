/**
 * Where the backend is and the shared secret of this server — read from the environment on every
 * call (never at module load, so `next build` needs neither) and checked by hand:
 *
 *   BACKEND_URL       http(s) origin of the NestJS backend, e.g. http://127.0.0.1:4000 (dev),
 *                     http://backend:4000 (compose); never exposed to browsers
 *   INTERNAL_API_KEY  the backend's INTERNAL_API_KEY (≥ 32 characters), sent as x-internal-key
 *
 * No runtime imports: also used by src/proxy.ts (session refresh).
 */

export type BackendEnv = {
  /** Origin without a trailing slash */
  readonly backendUrl: string;
  readonly internalKey: string;
};

export type BackendEnvResult = { ok: true; env: BackendEnv } | { ok: false; problem: string };

export const INTERNAL_API_KEY_MIN_LENGTH = 32;

/** The validated variables, or what is wrong with them (names only — never a value). */
export function readBackendEnv(source: Readonly<Record<string, string | undefined>> = process.env): BackendEnvResult {
  const backendUrl = parseOrigin(source.BACKEND_URL);
  if (backendUrl === null)
    return { ok: false, problem: 'BACKEND_URL must be an http(s) origin, e.g. http://127.0.0.1:4000' };
  const internalKey = source.INTERNAL_API_KEY ?? '';
  if (internalKey.length < INTERNAL_API_KEY_MIN_LENGTH) {
    return { ok: false, problem: `INTERNAL_API_KEY must be set (at least ${INTERNAL_API_KEY_MIN_LENGTH} characters)` };
  }
  return { ok: true, env: { backendUrl, internalKey } };
}

function parseOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}
