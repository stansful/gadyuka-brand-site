import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

/**
 * Lead rate limiting.
 *
 * - The IP is never stored: Lead.ipHash = HMAC-SHA256(key = IP_HASH_SALT, network) (hex), where
 *   network = the IPv4 address, or the /64 prefix of an IPv6 address (one IPv6 subscriber
 *   usually owns a whole /64, so per-address keys would be free to rotate).
 * - IP_HASH_SALT is required in production (≥ 16 chars): with a known salt the 2^32 IPv4
 *   space is brute-forced in seconds and ipHash would effectively be the raw IP.
 * - Limits (checked inside one transaction under a per-ipHash advisory lock, see
 *   src/app/api/leads/store.ts, so parallel requests cannot all pass the count):
 *     LEAD_RATE_LIMIT        — per network: 5 leads / 10 min (6th → 429);
 *     LEAD_NOTIFY_CEILING    — site-wide: past 60 leads / 10 min leads are still stored, but
 *                              the Telegram notification is skipped (no chat / API flood).
 * - The counter is the Lead table itself (index [ipHash, createdAt]), so the limit
 *   survives restarts and works with several app instances.
 * - Only stored leads count; invalid / honeypot submissions are never stored.
 */

export const LEAD_RATE_LIMIT = {
  max: 5,
  windowMs: 10 * 60 * 1000,
} as const;

export const LEAD_NOTIFY_CEILING = {
  max: 60,
  windowMs: 10 * 60 * 1000,
} as const;

export const IP_HASH_SALT_MIN_LENGTH = 16;

/** Used only outside production when IP_HASH_SALT is not configured (a warning is logged once). */
const DEV_FALLBACK_SALT = 'gadyuka-ip-hash-dev-only-salt';

let warnedAboutSalt = false;

export class IpHashSaltError extends Error {
  constructor() {
    super(
      `IP_HASH_SALT is missing or shorter than ${IP_HASH_SALT_MIN_LENGTH} characters — refusing to hash client IPs in production. ` +
        'Set a random value (openssl rand -hex 32) in .env and restart.',
    );
    this.name = 'IpHashSaltError';
  }
}

/**
 * IP_HASH_SALT from the environment. Production: throws IpHashSaltError when it is missing
 * or too short (fail closed). Dev/test: falls back to a built-in salt with one warning.
 */
export function getIpHashSalt(env: { IP_HASH_SALT?: string; NODE_ENV?: string } = process.env): string {
  const salt = env.IP_HASH_SALT?.trim() ?? '';
  if (salt.length >= IP_HASH_SALT_MIN_LENGTH) return salt;
  if (env.NODE_ENV === 'production') throw new IpHashSaltError();
  if (!warnedAboutSalt) {
    warnedAboutSalt = true;
    console.warn(
      '[rate-limit] IP_HASH_SALT is not set (or too short) — using a dev-only salt. Set a random value in .env.',
    );
  }
  return salt || DEV_FALLBACK_SALT;
}

/** HMAC-SHA256(key = salt, message = ip), hex. Deterministic for the same IP + salt. */
export function hashIp(ip: string, salt: string): string {
  return createHmac('sha256', salt).update(ip.trim().toLowerCase(), 'utf8').digest('hex');
}

const MAX_IP_LENGTH = 64;

function cleanIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let ip = value.trim();
  // "[2001:db8::1]:443" → "2001:db8::1"; "203.0.113.7:51234" → "203.0.113.7"
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed?.[1]) ip = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  if (ip.length === 0 || ip.length > MAX_IP_LENGTH || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}

/** The 8 hextets of a valid IPv6 address (handles "::" and an embedded IPv4 tail), or null. */
function ipv6Hextets(ip: string): number[] | null {
  if (isIP(ip) !== 6) return null;
  let address = ip.toLowerCase();
  const tail: number[] = [];
  const v4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (v4) {
    const [a, b, c, d] = v4.slice(1, 5).map(Number);
    if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
    tail.push((a << 8) | b, (c << 8) | d);
    address = address.slice(0, v4.index);
    if (address.endsWith(':') && !address.endsWith('::')) address = address.slice(0, -1);
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string | undefined): number[] =>
    part
      ? part
          .split(':')
          .filter(group => group.length > 0)
          .map(group => Number.parseInt(group, 16))
      : [];
  const head = parse(halves[0]);
  const rest = [...parse(halves[1]), ...tail];
  const missing = 8 - head.length - rest.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...new Array<number>(missing).fill(0), ...rest];
  return groups.length === 8 && groups.every(group => Number.isInteger(group) && group >= 0 && group <= 0xffff)
    ? groups
    : null;
}

/**
 * Rate-limit network of an IP: IPv4 as is; IPv4-mapped IPv6 ("::ffff:1.2.3.4") as IPv4;
 * any other IPv6 as its /64 prefix ("2001:db8:1:2::/64").
 */
export function rateLimitNetwork(ip: string): string {
  const clean = ip.trim().toLowerCase();
  if (isIP(clean) !== 6) return clean;
  const groups = ipv6Hextets(clean);
  if (!groups) return clean;
  const mapped = groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xffff;
  if (mapped) {
    const high = groups[6] ?? 0;
    const low = groups[7] ?? 0;
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  }
  return `${groups
    .slice(0, 4)
    .map(group => group.toString(16))
    .join(':')}::/64`;
}

/**
 * Client IP behind the reverse proxy.
 * Production: Caddy sets `X-Real-IP` to the TCP peer and overwrites untrusted
 * `X-Forwarded-For`, and the app port is not exposed, so these headers can be trusted.
 * Order: X-Real-IP → last X-Forwarded-For entry (added by our proxy) → null.
 * Also used for the admin login throttle (src/lib/admin/auth.ts).
 */
export function getClientIp(headers: Headers): string | null {
  const realIp = cleanIp(headers.get('x-real-ip'));
  if (realIp) return realIp;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    const last = cleanIp(parts[parts.length - 1]);
    if (last) return last;
  }
  return null;
}

/** Rate-limit key of a request (unknown IPs share one bucket). Throws IpHashSaltError (production). */
export function rateLimitKey(headers: Headers, salt: string = getIpHashSalt()): string {
  const ip = getClientIp(headers);
  return hashIp(ip ? rateLimitNetwork(ip) : 'unknown', salt);
}

/** Counts leads with this ipHash created at or after `since`. */
export type RecentLeadCounter = (ipHash: string, since: Date) => Promise<number>;

export type RateLimitResult = { limited: false; remaining: number } | { limited: true; retryAfterSeconds: number };

export type RateLimitOptions = {
  count: RecentLeadCounter;
  /** Time of the oldest lead in the window (to compute Retry-After); optional. */
  oldestInWindow?: (ipHash: string, since: Date) => Promise<Date | null>;
  now?: Date;
  max?: number;
  windowMs?: number;
};

/** Check the limit for `ipHash`. Pure apart from the injected DB accessors. */
export async function checkRateLimit(ipHash: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const now = options.now ?? new Date();
  const max = options.max ?? LEAD_RATE_LIMIT.max;
  const windowMs = options.windowMs ?? LEAD_RATE_LIMIT.windowMs;
  const since = new Date(now.getTime() - windowMs);
  const count = await options.count(ipHash, since);
  if (count < max) return { limited: false, remaining: max - count - 1 };

  const oldest = options.oldestInWindow ? await options.oldestInWindow(ipHash, since) : null;
  const resetAt = oldest ? oldest.getTime() + windowMs : now.getTime() + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000));
  return { limited: true, retryAfterSeconds };
}
