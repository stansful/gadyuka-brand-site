import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';

import { CACHE_TAGS, CONTENT_CACHE_LIFE } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { defaultLocale, type Locale } from './locales';
import {
  MESSAGE_KEYS,
  resolveMessages,
  siteTextsFromMessages,
  type MessageKey,
  type MessageRow,
  type SiteMessages,
} from './messages';

/**
 * Site UI messages — the runtime side (server-only): `Message` rows overlaid on the JSON
 * defaults of ./messages.ts (resolveMessages documents the rules). Used by next-intl
 * (./request.ts → getTranslations / getMessages, fail-soft through loadSiteMessages) and by the
 * landing data (getLanding → texts).
 */

/**
 * The resolved message tree of `locale`. Cached like the rest of the public content
 * ("use cache" + cacheTag("content") + the "hours" profile; the locale is part of the cache
 * key), so an admin save that calls revalidateContent() shows up on the next request.
 */
export async function getSiteMessages(locale: Locale): Promise<SiteMessages> {
  'use cache';
  cacheTag(CACHE_TAGS.content);
  cacheLife(CONTENT_CACHE_LIFE);

  // Another locale also needs the default-locale rows (a blank translation falls back to them).
  const rows: MessageRow[] = await db.message.findMany({
    where: { locale: { in: locale === defaultLocale ? [locale] : [locale, defaultLocale] } },
    select: { key: true, locale: true, value: true },
  });

  if (process.env.NODE_ENV !== 'production') {
    const seeded = new Set(rows.filter(row => row.locale === locale).map(row => row.key));
    const missing = MESSAGE_KEYS.filter(key => !seeded.has(key));
    if (missing.length > 0) {
      console.warn(
        `[messages] ${missing.length} ${locale} message(s) have no DB row (defaults shown), e.g. ${missing.slice(0, 5).join(', ')} — run npm run db:seed`,
      );
    }
  }

  return resolveMessages(locale, rows);
}

/** At most one fallback log line per locale and interval: an outage is logged, not every render it hits. */
const FALLBACK_LOG_INTERVAL_MS = 60_000;

/**
 * When the fallback of each locale was last logged (performance.now(): monotonic, and not a value
 * Cache Components guards). A successful read does not reset it: during an outage, renders that
 * hit a cache entry from before still succeed, so a success does not mean the database is back.
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
 * getSiteMessages for renders that must survive a database outage: when the messages cannot be
 * read (the DB is down and the cache entry is cold or expired), the bundled defaults of
 * messages/<locale>.json stand in — without the admin's edits, but the page still renders.
 * Used where an error would take down the whole document: next-intl's request config
 * (./request.ts — every t() of the site, the admin and the Route Handlers) and the [locale]
 * root layout, which no error.tsx can catch.
 *
 * The fallback is decided OUTSIDE the cache on purpose: getSiteMessages never stores it, so the
 * first read after the database is back serves the edited copy again. For the same reason this
 * must not run inside "use cache" (the caller's entry would keep the defaults): cached code reads
 * getSiteMessages / getSiteTexts and fails together with the rest of its data.
 */
export async function loadSiteMessages(locale: Locale): Promise<SiteMessages> {
  try {
    return await getSiteMessages(locale);
  } catch (error: unknown) {
    // Next.js control flow (prerender interruptions, dynamic bail-outs) is not a DB failure.
    unstable_rethrow(error);
    logFallback(locale, error);
    return resolveMessages(locale, []);
  }
}

/** The same messages as a flat, typed record: texts["hero.title"] (the landing sections' shape). */
export async function getSiteTexts(locale: Locale): Promise<Record<MessageKey, string>> {
  return siteTextsFromMessages(await getSiteMessages(locale));
}
