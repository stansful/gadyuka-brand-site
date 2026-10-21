import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { connection } from 'next/server';

import type { Locale } from '@/i18n/locales';
import { publicRead } from '@/lib/api/public';
import type { LandingResponse, PublicCollectionResponse, PublicSettingsResponse } from '@shared/contracts/content';

import type { CollectionView, LandingContent, SettingsView } from './types';

import { CACHE_TAGS, CONTENT_CACHE_LIFE } from './cache';
import { toCollectionView, toLandingContent, toSettingsView } from './mappers';
import { offerExpiryCacheLife } from './offer-cache-life';
import { findPublicData, readPublicData } from './public-api';

/**
 * The public content read layer: the backend's /api/v1/public/* (the queries, the
 * localization, the limits and the order of every list live there), cached here with the Next 16
 * Cache Components API ("use cache" + cacheTag('content') + cacheLife). The locale (and the slug)
 * are part of the cache key; admin writes refresh everything with updateTag('content').
 *
 * Request time only (src/lib/api/README.md): every function passes connection() before its cached
 * read, so `next build` never calls the backend. A backend failure throws (never cached): the
 * page's error boundary shows.
 */

/**
 * Everything the landing renders for `locale` (GET /public/landing/:locale): the site messages
 * (`texts`), the landing images, the menu, the social links, the published entities and the
 * settings. Cached "hours", shortened before the earliest offer end (offerExpiryCacheLife).
 */
export async function getLanding(locale: Locale): Promise<LandingContent> {
  await connection();
  return getCachedLanding(locale);
}

async function getCachedLanding(locale: Locale): Promise<LandingContent> {
  'use cache';
  cacheTag(CACHE_TAGS.content);
  const response = await readPublicData<LandingResponse>(`/api/v1/public/landing/${locale}`);
  const now = new Date();
  // Nothing invalidates the cache when an offer's validUntil passes, so the entry must not outlive
  // the earliest end. Exactly one cacheLife() call per invocation (Next.js docs).
  const offerLife = offerExpiryCacheLife(response.offersExpireAt, now);
  if (offerLife) cacheLife(offerLife);
  else cacheLife(CONTENT_CACHE_LIFE);
  return toLandingContent(response, now);
}

/** Site settings only (contacts, review scale, SEO defaults) — for generateMetadata and the manifest. */
export async function getSiteSettings(locale: Locale): Promise<SettingsView> {
  const response = await publicRead<PublicSettingsResponse>(`/api/v1/public/settings/${locale}`);
  return toSettingsView(response.settings);
}

/** One published collection with its published products, or null (→ notFound()). */
export async function getCollectionBySlug(locale: Locale, slug: string): Promise<CollectionView | null> {
  await connection();
  return getCachedCollection(locale, slug);
}

async function getCachedCollection(locale: Locale, slug: string): Promise<CollectionView | null> {
  'use cache';
  cacheTag(CACHE_TAGS.content);
  cacheLife(CONTENT_CACHE_LIFE);
  const path = `/api/v1/public/collections/${encodeURIComponent(slug)}` as const;
  const response = await findPublicData<PublicCollectionResponse>(path, { locale });
  return response ? toCollectionView(response.collection) : null;
}
