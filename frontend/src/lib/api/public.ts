import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { connection } from 'next/server';

import { CACHE_TAGS, CONTENT_CACHE_LIFE } from '@/lib/content/cache';

import { ApiRequestError } from './api-result';
import { apiRequest, type ApiPath } from './client';

/**
 * Public site data from the backend (/api/v1/public/*), the ONE way to read it:
 *
 *   const landing = await publicRead<LandingResponse>(`/api/v1/public/landing/${locale}`);
 *
 * 1. `await connection()` first — outside the cache: rendering waits for a real request, so
 *    `next build` (the Docker build, no backend there) never runs the read and never bakes data into
 *    the build output. The route renders on request (its root layout declares `instant = false`).
 * 2. the read itself is "use cache" + cacheTag('content') + cacheLife('hours') (CONTENT_CACHE_LIFE):
 *    one backend call per path and hour at most; every admin write that changes public content ends
 *    with updateTag('content') (adminApiAction `revalidatesContent`) and the next request reads fresh.
 * 3. a failure throws ApiRequestError and is never cached: the page's error boundary shows, or the
 *    caller catches it for a fallback (src/i18n/site-messages.ts falls back to the bundled defaults).
 *
 * Rules for callers: call it from server components, generateMetadata, route handlers (sitemap,
 * manifest) — never from inside another "use cache" function (connection() is not allowed there:
 * cache the result of publicRead in your own "use cache" function via `cachedPublicRead` instead), and
 * never from generateStaticParams (that runs at build time: return a placeholder there).
 */
export async function publicRead<T>(path: ApiPath): Promise<T> {
  await connection();
  return cachedPublicRead<T>(path);
}

/**
 * The cached read without the request-time gate — only for code that is itself inside "use cache"
 * (whose caller already passed connection()). Tagged 'content'; failures throw and are not cached.
 */
export async function cachedPublicRead<T>(path: ApiPath): Promise<T> {
  'use cache';
  cacheTag(CACHE_TAGS.content);
  cacheLife(CONTENT_CACHE_LIFE);
  const result = await apiRequest<T>(path);
  if (!result.ok) throw new ApiRequestError(path, result.failure);
  return result.data;
}
