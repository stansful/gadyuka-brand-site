import 'server-only';
import { readAdminData, readAdminRow } from '@/lib/api/admin-read';
import type { ApiPath } from '@/lib/api/client';
import { missingLocales, readText } from '@/lib/localized-text';
import type {
  AdminCollectionDetailsResponse,
  AdminCollectionListItem,
  AdminCollectionListResponse,
  AdminProductDetailsResponse,
  AdminProductListItem,
  AdminProductListResponse,
  AdminReviewDetailsResponse,
  AdminReviewListItem,
  AdminReviewListResponse,
  AdminReviewRatingScaleResponse,
  AdminSiteSettingsResponse,
} from '@shared/contracts/catalog';

import type { CollectionOption, ProductGroup } from '../catalog-view';
import type { AdminTranslator } from '../i18n';
import type { EntityRow } from '../types';

import { requireAdminPage } from '../auth';
import { ADMIN_LOCALE } from '../i18n';
import { getAdminTranslations } from '../i18n-server';
import { formatRubles, formatStars } from '../labels';

/**
 * Catalog: collections, products, reviews, site settings.
 *
 * Admin data of the catalog pages from the backend (/api/v1/admin/{collections,products,reviews,settings},
 * shared/contracts/catalog.ts). EVERY exported function authorizes first (requireAdminPage → redirect to
 * /admin/login), so a page can never read admin data without a session; the backend checks the session
 * and the ADMIN role again. Lists become the rows of the generic admin list (translated meta texts);
 * a form gets the backend's answer as is (null when the row does not exist → the page answers 404).
 */

const COLLECTIONS: ApiPath = '/api/v1/admin/collections';
const PRODUCTS: ApiPath = '/api/v1/admin/products';
const REVIEWS: ApiPath = '/api/v1/admin/reviews';
const RATING_SCALE: ApiPath = '/api/v1/admin/reviews/rating-scale';
const SETTINGS: ApiPath = '/api/v1/admin/settings';

/** Longest review text shown in a list row. */
const REVIEW_PREVIEW_LENGTH = 120;

export async function listCollectionsAdmin(): Promise<EntityRow[]> {
  await requireAdminPage();
  const [list, t, tCommon] = await Promise.all([
    readAdminData<AdminCollectionListResponse>(COLLECTIONS),
    getAdminTranslations('admin.collections'),
    getAdminTranslations('admin.common'),
  ]);
  return list.items.map(item => collectionRow(item, t, tCommon));
}

function collectionRow(
  item: AdminCollectionListItem,
  t: AdminTranslator<'admin.collections'>,
  tCommon: AdminTranslator<'admin.common'>,
): EntityRow {
  return {
    id: item.id,
    title: readText(item.title, ADMIN_LOCALE) || item.slug,
    subtitle: `/${item.slug}`,
    thumb: item.cover,
    href: `/admin/collections/${item.id}`,
    published: item.published,
    missingLocales: missingLocales(item.title),
    meta: tCommon('products', { count: item.productCount }),
    deleteWarning: item.productCount > 0 ? t('deleteWarning', { count: item.productCount }) : undefined,
  };
}

export async function getCollectionOptions(): Promise<CollectionOption[]> {
  await requireAdminPage();
  const list = await readAdminData<AdminCollectionListResponse>(COLLECTIONS);
  return list.items.map(item => ({
    id: item.id,
    slug: item.slug,
    title: readText(item.title, ADMIN_LOCALE) || item.slug,
  }));
}

export async function getCollectionForm(id: string): Promise<AdminCollectionDetailsResponse | null> {
  await requireAdminPage();
  return readAdminRow<AdminCollectionDetailsResponse>(`${COLLECTIONS}/${encodeURIComponent(id)}`);
}

export async function listProductsAdmin(): Promise<ProductGroup[]> {
  await requireAdminPage();
  const [list, t] = await Promise.all([
    readAdminData<AdminProductListResponse>(PRODUCTS),
    getAdminTranslations('admin.products'),
  ]);
  return list.groups.map(({ collection, products }) => ({
    collection: {
      id: collection.id,
      slug: collection.slug,
      title: readText(collection.title, ADMIN_LOCALE) || collection.slug,
      published: collection.published,
    },
    rows: products.map(product => productRow(product, t)),
  }));
}

function productRow(product: AdminProductListItem, t: AdminTranslator<'admin.products'>): EntityRow {
  return {
    id: product.id,
    title: readText(product.title, ADMIN_LOCALE) || product.slug,
    subtitle: `/${product.slug}`,
    thumb: product.cover,
    href: `/admin/products/${product.id}`,
    published: product.published,
    missingLocales: missingLocales(product.title),
    meta: [
      product.price === null ? t('priceOnRequest') : formatRubles(product.price),
      t('photos', { count: product.imageCount }),
    ].join(' · '),
  };
}

export async function getProductForm(id: string): Promise<AdminProductDetailsResponse | null> {
  await requireAdminPage();
  return readAdminRow<AdminProductDetailsResponse>(`${PRODUCTS}/${encodeURIComponent(id)}`);
}

// ── reviews ───────────────────────────────────────────────────────────────────

/** Current star scale of review ratings (SiteSettings.reviewRatingMax; 5 before the first save). */
export async function getReviewRatingMax(): Promise<number> {
  await requireAdminPage();
  return (await readAdminData<AdminReviewRatingScaleResponse>(RATING_SCALE)).max;
}

/**
 * Reviews in list order. `ratingAbove` keeps only reviews rated higher than that (the
 * settings page links here when the star scale cannot be lowered).
 */
export async function listReviewsAdmin(filter: { ratingAbove?: number } = {}): Promise<EntityRow[]> {
  await requireAdminPage();
  const [list, t] = await Promise.all([
    readAdminData<AdminReviewListResponse>(REVIEWS, { query: { ratingAbove: filter.ratingAbove } }),
    getAdminTranslations('admin.reviews'),
  ]);
  return list.items.map(item => reviewRow(item, list.ratingMax, t));
}

function reviewRow(item: AdminReviewListItem, ratingMax: number, t: AdminTranslator<'admin.reviews'>): EntityRow {
  const text = readText(item.text, ADMIN_LOCALE);
  return {
    id: item.id,
    title: item.author,
    subtitle: text.length > REVIEW_PREVIEW_LENGTH ? `${text.slice(0, REVIEW_PREVIEW_LENGTH)}…` : text,
    thumb: item.avatar,
    href: `/admin/reviews/${item.id}`,
    published: item.published,
    missingLocales: missingLocales(item.text),
    meta:
      [readText(item.role, ADMIN_LOCALE), ratingLabel(item.rating, ratingMax, t)].filter(Boolean).join(' · ') ||
      undefined,
  };
}

/** "★★★★☆", «7 из 5 — выше шкалы» for a rating above a lowered scale, "" without a rating. */
function ratingLabel(rating: number | null, max: number, t: AdminTranslator<'admin.reviews'>): string {
  if (rating === null) return '';
  return rating > max ? t('aboveScale', { rating, max }) : formatStars(rating, max);
}

export async function getReviewForm(id: string): Promise<AdminReviewDetailsResponse | null> {
  await requireAdminPage();
  return readAdminRow<AdminReviewDetailsResponse>(`${REVIEWS}/${encodeURIComponent(id)}`);
}

// ── settings ──────────────────────────────────────────────────────────────────

export async function getSettingsForm(): Promise<AdminSiteSettingsResponse> {
  await requireAdminPage();
  return readAdminData<AdminSiteSettingsResponse>(SETTINGS);
}

// ── backend reads ─────────────────────────────────────────────────────────────

/** The data of a page; any failure throws ApiRequestError (the admin error page). */
