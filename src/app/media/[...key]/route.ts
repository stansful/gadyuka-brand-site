import { getObject, headObject, type StoredObjectInfo } from '@/lib/storage';
import {
  isServedMediaContentType,
  MEDIA_CACHE_CONTROL,
  mediaContentTypeForKey,
  parseMediaKey,
} from '@/lib/storage/keys';

/**
 * Media file server: GET|HEAD /media/<key> streams the object <key> from the S3 bucket
 * (MinIO), e.g. /media/admin/<ownerId>/<uuid>/image.webp. The bucket is private — this
 * handler is the only way in, in dev and in production (Caddy proxies /media/* here like any
 * other path), and it is the upstream of next/image for Media.url (images.localPatterns).
 *
 * Safety:
 *  - parseMediaKey() accepts only 1–8 segments of [A-Za-z0-9._-] (no "..", no hidden
 *    segments, within the storage's name length limits) ending in a raster image extension —
 *    nothing else is looked up, so a storage error is never caused by the requested name;
 *  - only raster image types are sent (an unexpected stored Content-Type falls back to the
 *    type of the extension), with nosniff and a sandbox CSP — nothing can execute.
 * Keys are never reused (a new uuid per upload), so responses are cached immutably.
 */

/**
 * Lets a browser display the image when the URL is opened directly (Firefox applies the CSP
 * to its image document too), still without any scripts.
 */
const MEDIA_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";

type MediaRouteContext = RouteContext<'/media/[...key]'>;

const plainResponse = (status: number, text: string): Response =>
  new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

const notFound = (): Response => plainResponse(404, 'Not found');

/** nginx's "Client Closed Request": nobody receives it, it only marks the request as cancelled. */
const CLIENT_CLOSED_REQUEST = 499;

/**
 * A failed S3 call. When the client has gone away, request.signal aborted the call (AbortError):
 * a normal cancellation, not a storage failure — answered without a log line.
 */
function storageFailure(request: Request, key: string, error: unknown): Response {
  if (request.signal.aborted) {
    return new Response(null, { status: CLIENT_CLOSED_REQUEST, headers: { 'Cache-Control': 'no-store' } });
  }
  console.error(`[media] reading "${key}" from S3 failed:`, error);
  return plainResponse(502, 'Media storage is unavailable');
}

function mediaHeaders(key: string, info: StoredObjectInfo): Headers {
  const headers = new Headers({
    'Content-Type': isServedMediaContentType(info.contentType) ? info.contentType : mediaContentTypeForKey(key),
    'Cache-Control': MEDIA_CACHE_CONTROL,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': MEDIA_CSP,
  });
  if (info.contentLength !== undefined) headers.set('Content-Length', String(info.contentLength));
  if (info.etag) headers.set('ETag', info.etag);
  if (info.lastModified) headers.set('Last-Modified', info.lastModified.toUTCString());
  return headers;
}

/** If-None-Match (a list of tags, weak or strong, or "*") matches the object's ETag (weak comparison). */
function etagMatches(ifNoneMatch: string | null, etag: string | undefined): boolean {
  if (!ifNoneMatch || !etag) return false;
  if (ifNoneMatch.trim() === '*') return true;
  const opaque = (tag: string): string => tag.trim().replace(/^W\//, '');
  const current = opaque(etag);
  return ifNoneMatch.split(',').some(tag => opaque(tag) === current);
}

function notModified(headers: Headers): Response {
  // A 304 carries the validators and caching headers, never a body or its length.
  headers.delete('Content-Length');
  return new Response(null, { status: 304, headers });
}

export async function GET(request: Request, { params }: MediaRouteContext): Promise<Response> {
  const key = parseMediaKey((await params).key);
  if (!key) return notFound();
  const ifNoneMatch = request.headers.get('if-none-match');

  try {
    // Revalidation (rare: the responses are immutable) → compare with HEAD, no body transfer.
    if (ifNoneMatch) {
      const info = await headObject(key, { signal: request.signal });
      if (!info) return notFound();
      if (etagMatches(ifNoneMatch, info.etag)) return notModified(mediaHeaders(key, info));
    }

    const result = await getObject(key, { signal: request.signal });
    if (result.kind === 'missing') return notFound();
    return new Response(result.body, { status: 200, headers: mediaHeaders(key, result.info) });
  } catch (error: unknown) {
    return storageFailure(request, key, error);
  }
}

/** HEAD without downloading the object (Next would otherwise run GET and drop the body). */
export async function HEAD(request: Request, { params }: MediaRouteContext): Promise<Response> {
  const key = parseMediaKey((await params).key);
  if (!key) return notFound();

  try {
    const info = await headObject(key, { signal: request.signal });
    if (!info) return notFound();
    const headers = mediaHeaders(key, info);
    if (etagMatches(request.headers.get('if-none-match'), info.etag)) return notModified(headers);
    return new Response(null, { status: 200, headers });
  } catch (error: unknown) {
    return storageFailure(request, key, error);
  }
}
