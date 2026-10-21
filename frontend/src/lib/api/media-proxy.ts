import { readBackendEnv } from './backend-env';

/**
 * GET|HEAD /media/<key> of the site → GET|HEAD ${BACKEND_URL}/media/<key>, streamed. The backend
 * serves the stored object (ETag / 304, Range / 206, immutable Cache-Control, nosniff, sandbox CSP);
 * this only passes the conditional / range request headers in and the response through, so
 * next/image (images.localPatterns /media/**) and plain links keep working on the same origin.
 * In production the reverse proxy may route /media/* straight to the backend instead
 * (docs/COMPRESSION.md); this handler is then only the fallback for direct `next start` access.
 *
 * No runtime imports beyond ./backend-env (unit-tested with a stubbed fetch).
 */

/** Request headers forwarded to the backend. */
const FORWARDED_REQUEST_HEADERS = ['if-none-match', 'if-modified-since', 'range', 'if-range'] as const;

/** Response headers passed back to the browser (caching, body description, security). */
const FORWARDED_RESPONSE_HEADERS = [
  'cache-control',
  'content-type',
  'content-length',
  'content-range',
  'content-disposition',
  'accept-ranges',
  'etag',
  'last-modified',
  'x-content-type-options',
  'content-security-policy',
  'cross-origin-resource-policy',
] as const;

/** At most this many "/"-separated segments, each of a safe shape (the backend checks the full rules). */
const MAX_SEGMENTS = 8;
const SEGMENT = /^[A-Za-z0-9._-]{1,255}$/;

/** Statuses whose response never has a body. */
const BODYLESS_STATUSES: ReadonlySet<number> = new Set([204, 304]);

/** nginx's "Client Closed Request": nobody receives it, it only marks the request as cancelled. */
const CLIENT_CLOSED_REQUEST = 499;

/**
 * Longest wait for the backend's response headers. A stalled backend (blocked event loop, hanging
 * storage read) would otherwise hold the request until undici's 300 s headers timeout — and
 * /_next/image fetches this handler with no client signal at all, so its requests never end sooner.
 * The body is not bounded: once the headers are in, it streams at the visitor's pace.
 */
export const MEDIA_HEADERS_TIMEOUT_MS = 10_000;

export async function proxyMediaRequest(request: Request, segments: readonly string[]): Promise<Response> {
  const key = mediaKeyOf(segments);
  if (key === null) return plainResponse(404, 'Not found');
  const config = readBackendEnv();
  if (!config.ok) {
    console.error(`[media] backend not configured: ${config.problem}`);
    return plainResponse(502, 'Media storage is unavailable');
  }
  const headersTimeout = new AbortController();
  const timer = setTimeout(() => headersTimeout.abort(), MEDIA_HEADERS_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${config.env.backendUrl}/media/${key}`, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: forwardedRequestHeaders(request.headers),
      signal: AbortSignal.any([request.signal, headersTimeout.signal]),
      redirect: 'manual',
    });
    const hasBody = request.method !== 'HEAD' && !BODYLESS_STATUSES.has(upstream.status);
    return new Response(hasBody ? upstream.body : null, {
      status: upstream.status,
      headers: forwardedResponseHeaders(upstream.headers),
    });
  } catch (error: unknown) {
    if (request.signal.aborted) return new Response(null, { status: CLIENT_CLOSED_REQUEST, headers: NO_STORE });
    if (headersTimeout.signal.aborted) {
      console.error(`[media] backend did not answer for "${key}" within ${MEDIA_HEADERS_TIMEOUT_MS} ms`);
      return plainResponse(504, 'Media storage is unavailable');
    }
    console.error(`[media] backend request for "${key}" failed:`, error);
    return plainResponse(502, 'Media storage is unavailable');
  } finally {
    clearTimeout(timer);
  }
}

/** The key as a URL path (segments re-encoded), or null for a key no stored object can have. */
function mediaKeyOf(segments: readonly string[]): string | null {
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) return null;
  if (segments.some(segment => !SEGMENT.test(segment) || segment.startsWith('.'))) return null;
  return segments.map(segment => encodeURIComponent(segment)).join('/');
}

function forwardedRequestHeaders(incoming: Headers): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

function forwardedResponseHeaders(upstream: Headers): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (!headers.has('x-content-type-options')) headers.set('x-content-type-options', 'nosniff');
  return headers;
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function plainResponse(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...NO_STORE },
  });
}
