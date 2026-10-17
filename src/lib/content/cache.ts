import "server-only";
import { revalidateTag, updateTag } from "next/cache";

/**
 * Cache tags for the content read layer (Next 16 Cache Components model:
 * `"use cache"` + `cacheTag()` + `cacheLife()` inside the read functions).
 *
 * Every cached content function tags itself with CACHE_TAGS.content, so ONE call
 * refreshes the whole public site (all locales, landing + catalog pages + metadata).
 */
export const CACHE_TAGS = {
  /** All public content: ContentBlock, Media, Collection, Product, Review, NewsItem,
   *  GalleryItem, Offer, Partner, SiteSettings. */
  content: "content",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * cacheLife profile used by the content functions: "hours" = stale 5 min,
 * revalidate 1 h, expire 1 day. Admin writes invalidate immediately via the
 * helpers below; the hourly revalidation is only a safety net for out-of-band
 * DB changes (seed, manual SQL).
 */
export const CONTENT_CACHE_LIFE = "hours";

/**
 * Call at the end of every admin **Server Action** that writes public content.
 * Uses `updateTag` (read-your-own-writes: the next request renders fresh data).
 * Throws if called outside a Server Action — use revalidateContentFromRoute there.
 */
export function revalidateContent(): void {
  updateTag(CACHE_TAGS.content);
}

/**
 * Same as revalidateContent, for **Route Handlers** (e.g. a media upload endpoint),
 * where updateTag is not allowed. `{ expire: 0 }` = no stale content is served.
 */
export function revalidateContentFromRoute(): void {
  revalidateTag(CACHE_TAGS.content, { expire: 0 });
}
