import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { connection } from 'next/server';

import { cachedPublicRead } from '@/lib/api/public';
import type { SiteMessagesResponse } from '@shared/contracts/content';

import { type Locale } from './locales';
import {
  defaultSiteMessages,
  siteMessagesFromTree,
  siteTextsFromMessages,
  type MessageKey,
  type SiteMessages,
} from './messages';

/**
 * Site UI messages — the runtime side (server-only): the backend's GET /api/v1/public/messages/:locale
 * (the admin's Message rows over the shared/messages defaults, resolved by the backend), cached like
 * the rest of the public content ("use cache" + cacheTag('content') + the "hours" profile, see
 * src/lib/api/public.ts). Used by next-intl (./request.ts → getTranslations / getMessages, fail-soft
 * through loadSiteMessages) and by the landing data (getLanding → texts).
 *
 * This is the example of the request-time rule of public reads (docs/ARCHITECTURE.md, «Данные
 * сайта»): loadSiteMessages passes connection() first, so `next build` never calls the backend.
 */

/**
 * The resolved message tree of `locale` (cached; the locale is part of the cache key), so an admin
 * save that ends with updateTag('content') shows up on the next request. Throws when the backend
 * cannot answer (never cached). Usable inside "use cache" (no request-time API in here).
 */
export async function getSiteMessages(locale: Locale): Promise<SiteMessages> {
  const response = await cachedPublicRead<SiteMessagesResponse>(`/api/v1/public/messages/${locale}`);
  return siteMessagesFromTree(locale, response.messages);
}

/** At most one fallback log line per locale and interval: an outage is logged, not every render it hits. */
const FALLBACK_LOG_INTERVAL_MS = 60_000;

/**
 * When the fallback of each locale was last logged (performance.now(): monotonic, and not a value
 * Cache Components guards). A successful read does not reset it: during an outage, renders that
 * hit a cache entry from before still succeed, so a success does not mean the backend is back.
 */
const fallbackLoggedAt = new Map<Locale, number>();

function logFallback(locale: Locale, error: unknown): void {
  const now = performance.now();
  const last = fallbackLoggedAt.get(locale);
  if (last !== undefined && now - last < FALLBACK_LOG_INTERVAL_MS) return;
  fallbackLoggedAt.set(locale, now);
  console.error(`[messages] cannot read the ${locale} site messages, showing the bundled defaults:`, error);
}

/**
 * getSiteMessages for renders that must survive a backend outage, at request time only:
 * - `await connection()` first: prerendering (next build — no backend there) stops here, the page
 *   renders on request (the [locale] root layout declares `instant = false`);
 * - when the messages cannot be read (the backend is down and the cache entry is cold or expired),
 *   the bundled defaults of shared/messages/<locale>.json stand in — without the admin's edits, but
 *   the page still renders. Used where an error would take down the whole document: next-intl's
 *   request config (./request.ts — every t() of the site, the admin and the Route Handlers) and the
 *   [locale] root layout, which no error.tsx can catch.
 *
 * The fallback is decided OUTSIDE the cache on purpose: getSiteMessages never stores it, so the
 * first read after the backend is back serves the edited copy again. For the same reason this must
 * not run inside "use cache" (connection() is not allowed there anyway): cached code reads
 * getSiteMessages / getSiteTexts and fails together with the rest of its data.
 */
export async function loadSiteMessages(locale: Locale): Promise<SiteMessages> {
  await connection();
  try {
    return await getSiteMessages(locale);
  } catch (error: unknown) {
    // Next.js control flow (prerender interruptions, dynamic bail-outs) is not a backend failure.
    unstable_rethrow(error);
    logFallback(locale, error);
    return defaultSiteMessages(locale);
  }
}

/** The same messages as a flat, typed record: texts["hero.title"] (the landing sections' shape). */
export async function getSiteTexts(locale: Locale): Promise<Record<MessageKey, string>> {
  return siteTextsFromMessages(await getSiteMessages(locale));
}
