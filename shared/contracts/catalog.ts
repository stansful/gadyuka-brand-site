/**
 * Admin catalog (owner: slice S4a): collections, products (+ images), reviews and the site settings
 * under /api/v1/admin/{collections,products,reviews,settings}. Publish / reorder / delete of these
 * rows: ./entities.ts. Lists come in the site's order (manual `order`, then creation time).
 *
 * - GET  /admin/collections                → AdminCollectionListResponse
 * - GET  /admin/collections/:id            → AdminCollectionDetailsResponse
 * - POST /admin/collections                AdminCollectionSaveRequest → 201 AdminCatalogRowSaved (appended last)
 * - PUT  /admin/collections/:id            AdminCollectionSaveRequest → 200 AdminCatalogRowSaved
 * - GET  /admin/products                   → AdminProductListResponse (grouped by collection)
 * - GET  /admin/products/:id               → AdminProductDetailsResponse
 * - POST /admin/products                   AdminProductSaveRequest → 201 AdminCatalogRowSaved
 * - PUT  /admin/products/:id               AdminProductSaveRequest → 200 AdminCatalogRowSaved
 *   (photos stored in the order of `imageIds`; a new product, or one moved to another collection, goes last there)
 * - GET  /admin/reviews?ratingAbove=N      AdminReviewListQuery → AdminReviewListResponse
 * - GET  /admin/reviews/rating-scale       → AdminReviewRatingScaleResponse
 * - GET  /admin/reviews/:id                → AdminReviewDetailsResponse
 * - POST /admin/reviews                    AdminReviewSaveRequest → 201 AdminCatalogRowSaved
 * - PUT  /admin/reviews/:id                AdminReviewSaveRequest → 200 AdminCatalogRowSaved
 * - GET  /admin/settings                   → AdminSiteSettingsResponse (defaults before the first save)
 * - PUT  /admin/settings                   AdminSiteSettingsSaveRequest → 204
 *
 * Errors (ApiErrorResponse keys of shared/messages/admin/ru.json):
 * - 400 validation: dotted field paths of the body ("slug", "title.en", "imageIds") with
 *   admin.validation.* keys (+ ICU values: { max } …), "ratingAbove" of the review list query;
 * - 400 badRequest admin.errors.invalidId — the `:id` of the path is not a row id (UUID);
 * - 409 conflict admin.errors.slugTaken — the slug belongs to another collection / product (field `slug`);
 * - 400 badRequest admin.errors.missingMedia — a picked media file no longer exists (coverId, imageIds,
 *   avatarId, ogImageId);
 * - 400 badRequest admin.products.collectionNotFound — `collectionId` of a product;
 * - 404 notFound admin.products.notFound — PUT of a product deleted meanwhile;
 * - 400 badRequest admin.reviews.ratingAboveScale { rating, max } — the rating exceeds the current star
 *   scale (SiteSettings.reviewRatingMax);
 * - 409 conflict admin.settings.scaleTooLow { count, max } — `count` reviews are rated above the new
 *   scale `max` (the admin lists them with GET /admin/reviews?ratingAbove=<max>);
 * - 404 notFound admin.errors.notFound (unknown row), 409 admin.errors.duplicate / admin.errors.related
 *   (a concurrent change hit a unique / foreign key constraint).
 */

import type { LocalizedText, MediaRef, Uuid } from './common';

/** Answer of every create / update: the id of the saved row. */
export interface AdminCatalogRowSaved {
  readonly id: Uuid;
}

// ── collections ──────────────────────────────────────────────────────────────

export interface AdminCollectionSaveRequest {
  /** URL slug: a-z, 0-9 and single hyphens (trimmed, lower-cased), unique among collections */
  readonly slug: string;
  /** Russian required, ≤ 200 per translation; empty translations are dropped */
  readonly title: LocalizedText;
  /** ≤ 5000 per translation */
  readonly description: LocalizedText;
  readonly coverId: Uuid | null;
  readonly published: boolean;
}

export interface AdminCollectionListItem {
  readonly id: Uuid;
  readonly slug: string;
  readonly title: LocalizedText;
  readonly published: boolean;
  readonly cover: MediaRef | null;
  readonly productCount: number;
}

export interface AdminCollectionListResponse {
  readonly items: readonly AdminCollectionListItem[];
}

export interface AdminCollectionDetailsResponse {
  readonly id: Uuid;
  readonly slug: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly cover: MediaRef | null;
  readonly published: boolean;
  /** Products deleted together with the collection */
  readonly productCount: number;
}

// ── products ─────────────────────────────────────────────────────────────────

export interface AdminProductSaveRequest {
  /** URL slug, unique among products */
  readonly slug: string;
  readonly collectionId: Uuid;
  /** Russian required, ≤ 200 per translation */
  readonly title: LocalizedText;
  /** ≤ 5000 per translation */
  readonly description: LocalizedText;
  /** ≤ 5000 per translation; one list item per line */
  readonly details: LocalizedText;
  /** Whole rubles 0 … 100 000 000; null = price on request */
  readonly price: number | null;
  /** Photos in display order (the first one is the main photo), ≤ 30, no repeats */
  readonly imageIds: readonly Uuid[];
  readonly published: boolean;
}

export interface AdminProductListItem {
  readonly id: Uuid;
  readonly slug: string;
  readonly title: LocalizedText;
  readonly price: number | null;
  readonly published: boolean;
  /** The first photo */
  readonly cover: MediaRef | null;
  readonly imageCount: number;
}

export interface AdminProductGroupCollection {
  readonly id: Uuid;
  readonly slug: string;
  readonly title: LocalizedText;
  readonly published: boolean;
}

/** One collection with its products (also a collection without products). */
export interface AdminProductGroup {
  readonly collection: AdminProductGroupCollection;
  readonly products: readonly AdminProductListItem[];
}

export interface AdminProductListResponse {
  readonly groups: readonly AdminProductGroup[];
}

export interface AdminProductDetailsResponse {
  readonly id: Uuid;
  readonly slug: string;
  readonly collectionId: Uuid;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly details: LocalizedText;
  readonly price: number | null;
  /** In display order */
  readonly images: readonly MediaRef[];
  readonly published: boolean;
}

// ── reviews ──────────────────────────────────────────────────────────────────

export interface AdminReviewSaveRequest {
  /** ≤ 120, trimmed, required */
  readonly author: string;
  /** ≤ 120 per translation */
  readonly role: LocalizedText;
  /** Russian required, ≤ 3000 per translation */
  readonly text: LocalizedText;
  readonly avatarId: Uuid | null;
  /** 1 … the current star scale (≤ 10); null = no rating */
  readonly rating: number | null;
  readonly published: boolean;
}

/** GET /admin/reviews: `ratingAbove` (0 … 10) keeps only reviews rated higher. */
export interface AdminReviewListQuery {
  readonly ratingAbove?: number;
}

export interface AdminReviewListItem {
  readonly id: Uuid;
  readonly author: string;
  readonly role: LocalizedText;
  readonly text: LocalizedText;
  readonly rating: number | null;
  readonly published: boolean;
  readonly avatar: MediaRef | null;
}

export interface AdminReviewListResponse {
  /** The current star scale (SiteSettings.reviewRatingMax) */
  readonly ratingMax: number;
  readonly items: readonly AdminReviewListItem[];
}

export interface AdminReviewRatingScaleResponse {
  /** Stars of a review rating: SiteSettings.reviewRatingMax (5 before the first save) */
  readonly max: number;
}

export interface AdminReviewDetailsResponse {
  readonly id: Uuid;
  readonly author: string;
  readonly role: LocalizedText;
  readonly text: LocalizedText;
  readonly avatar: MediaRef | null;
  readonly rating: number | null;
  readonly published: boolean;
}

// ── site settings ────────────────────────────────────────────────────────────

export interface AdminSiteSettingsSaveRequest {
  /** ≤ 40: digits, spaces and + ( ) . - (trimmed); "" = none */
  readonly phone: string;
  /** "" or an e-mail address ≤ 200 */
  readonly email: string;
  /** ≤ 300 per translation */
  readonly address: LocalizedText;
  /** Stars of a review rating, 1 … 10; never below a stored rating */
  readonly reviewRatingMax: number;
  /** ≤ 120 per translation */
  readonly seoTitle: LocalizedText;
  /** ≤ 400 per translation */
  readonly seoDescription: LocalizedText;
  readonly ogImageId: Uuid | null;
}

export interface AdminSiteSettingsResponse {
  readonly phone: string;
  readonly email: string;
  readonly address: LocalizedText;
  readonly reviewRatingMax: number;
  readonly seoTitle: LocalizedText;
  readonly seoDescription: LocalizedText;
  readonly ogImage: MediaRef | null;
}
