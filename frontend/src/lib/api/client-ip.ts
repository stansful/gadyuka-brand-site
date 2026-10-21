import { isIP } from 'node:net';

/**
 * The visitor's IP as our reverse proxy reports it:
 * X-Real-IP, else the LAST hop of X-Forwarded-For, else null. Never the request's own x-client-ip (a
 * browser could send one: the backend trusts that header from this server only).
 * - X-Real-IP: the proxy sets it from the TCP peer, overwriting a client-supplied value — Caddy
 *   `header_up X-Real-IP {remote_host}`, nginx `proxy_set_header X-Real-IP $remote_addr`.
 * - X-Forwarded-For: the last entry is the one our proxy added (a visitor can only prepend entries, so
 *   both an overwriting proxy and nginx's `$proxy_add_x_forwarded_for` give the peer address).
 * The Next.js port must not be reachable without the proxy (docs/COMPRESSION.md, «IP посетителя»):
 * then both headers come from the visitor. Without a proxy (local dev) Next.js fills X-Forwarded-For
 * with the socket address.
 *
 * No runtime imports beyond node:net (unit-tested; used by ./visitor.ts).
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const lastHop = headers.get('x-forwarded-for')?.split(',').at(-1);
  return normalizeIp(headers.get('x-real-ip')) ?? normalizeIp(lastHop);
}

/** A bare IPv4 / IPv6 address ("[::1]" and an IPv4 ":port" suffix are stripped), or null. */
function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim();
  if (candidate.startsWith('[') && candidate.includes(']')) candidate = candidate.slice(1, candidate.indexOf(']'));
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(candidate)) candidate = candidate.slice(0, candidate.lastIndexOf(':'));
  return isIP(candidate) === 0 ? null : candidate;
}
