import { defaultMessage, MESSAGE_KEYS } from '@/i18n/messages';
import type { LandingResponse, PublicCollection, PublicSettings } from '@shared/contracts/content';

import type { CollectionView, LandingContent, SettingsView } from './types';

import { IMAGE_KEYS } from './registry';

/**
 * Backend answers (shared/contracts/content.ts, already localized) → the view models the site
 * components render (./types.ts). The shapes match field for field; the mapping fills what the
 * components rely on: every message key and every landing image slot present, mutable arrays.
 */

/**
 * The landing for the components. `now`: the moment the cache entry is made (the footer's year).
 * - texts: every key of shared/messages/ru.json — the backend's value, else the bundled default (a
 *   key the backend does not know yet); keys the frontend does not know are dropped;
 * - images: every slot of the registry (CONTENT_IMAGES) — null when the backend has no picture for it.
 */
export function toLandingContent(response: LandingResponse, now: Date): LandingContent {
  const { locale } = response;
  return {
    locale,
    texts: recordFromKeys(MESSAGE_KEYS, key => response.texts[key] ?? defaultMessage(key, locale)),
    images: recordFromKeys(IMAGE_KEYS, key => response.images[key] ?? null),
    menu: [...response.menu],
    socials: [...response.socials],
    collections: response.collections.map(toCollectionView),
    reviews: [...response.reviews],
    news: [...response.news],
    gallery: [...response.gallery],
    offers: [...response.offers],
    partners: [...response.partners],
    settings: toSettingsView(response.settings),
    year: now.getFullYear(),
  };
}

export function toCollectionView(collection: PublicCollection): CollectionView {
  return {
    ...collection,
    products: collection.products.map(product => ({
      ...product,
      details: [...product.details],
      images: [...product.images],
    })),
  };
}

export function toSettingsView(settings: PublicSettings): SettingsView {
  return { ...settings };
}

/** Build a fully-populated record from a key list. */
export function recordFromKeys<K extends string, V>(keys: readonly K[], valueFor: (key: K) => V): Record<K, V> {
  const out: Partial<Record<K, V>> = {};
  for (const key of keys) out[key] = valueFor(key);
  // Every key was assigned above.
  return out as Record<K, V>;
}
