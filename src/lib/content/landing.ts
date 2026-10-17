import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/locales";
import { db } from "@/lib/db";
import { readText } from "@/lib/i18n-text";
import { CACHE_TAGS, CONTENT_CACHE_LIFE } from "./cache";
import { CONTENT_COPY } from "./default-copy";
import { mediaSelect, recordFromKeys, toImageRef, toLines } from "./mappers";
import { IMAGE_KEYS, TEXT_KEYS, type TextKey } from "./registry";
import { parseSocialLinks } from "./schemas";
import type {
  CollectionView,
  GalleryView,
  ImageRef,
  LandingContent,
  NewsView,
  OfferView,
  PartnerView,
  ReviewView,
  SettingsView,
} from "./types";

/** Upper bounds for public lists (the landing never renders unbounded queries). */
const LIMITS = {
  collections: 20,
  productsPerCollection: 48,
  reviews: 30,
  news: 12,
  gallery: 60,
  offers: 12,
  partners: 40,
} as const;

const collectionSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  cover: { select: mediaSelect },
  products: {
    where: { published: true },
    orderBy: [{ order: "asc" as const }, { createdAt: "asc" as const }],
    take: LIMITS.productsPerCollection,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      details: true,
      price: true,
      images: {
        orderBy: { order: "asc" as const },
        select: { media: { select: mediaSelect } },
      },
    },
  },
};

type CollectionRow = Awaited<ReturnType<typeof queryCollections>>[number];

function queryCollections(where: { published: true; slug?: string }) {
  return db.collection.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    take: LIMITS.collections,
    select: collectionSelect,
  });
}

function toCollectionView(row: CollectionRow, locale: Locale): CollectionView {
  return {
    id: row.id,
    slug: row.slug,
    title: readText(row.title, locale),
    description: readText(row.description, locale),
    cover: toImageRef(row.cover, locale),
    products: row.products.map((product) => ({
      id: product.id,
      slug: product.slug,
      title: readText(product.title, locale),
      description: readText(product.description, locale),
      details: toLines(readText(product.details, locale)),
      price: product.price,
      images: product.images
        .map((image) => toImageRef(image.media, locale))
        .filter((image): image is ImageRef => image !== null),
    })),
  };
}

async function loadSettings(locale: Locale): Promise<SettingsView> {
  const row = await db.siteSettings.findUnique({
    where: { id: 1 },
    include: { ogImage: { select: mediaSelect } },
  });
  if (!row) {
    return { phone: "", email: "", address: "", socials: [], seoTitle: "", seoDescription: "", ogImage: null };
  }
  return {
    phone: row.phone,
    email: row.email,
    address: readText(row.address, locale),
    socials: parseSocialLinks(row.socials),
    seoTitle: readText(row.seoTitle, locale),
    seoDescription: readText(row.seoDescription, locale),
    ogImage: toImageRef(row.ogImage, locale),
  };
}

type BlockRow = { value: unknown };

/**
 * Text of a content block. A registry key WITHOUT a DB row (added by a release, not seeded yet)
 * falls back to its default copy instead of rendering blank; a row that exists is shown as
 * stored — an admin may have emptied it on purpose (e.g. «Сноска под купонами»).
 */
export function blockText(key: TextKey, row: BlockRow | undefined, locale: Locale): string {
  return row ? readText(row.value, locale) : readText(CONTENT_COPY[key], locale);
}

/** Values of the "hours" profile (CONTENT_CACHE_LIFE), for the shortened inline variant. */
const HOURS_PROFILE = { stale: 300, revalidate: 3600, expire: 86_400 } as const;
/** Never regenerate more often than this for an upcoming offer expiry. */
const MIN_OFFER_REVALIDATE_SECONDS = 60;

/**
 * Landing cache lifetime when a visible offer expires before the regular hourly revalidation:
 * revalidate right after the earliest `validUntil`, so the next request after it regenerates
 * the page without the expired offer. null = the regular "hours" profile applies.
 */
export function offerExpiryCacheLife(
  offers: ReadonlyArray<{ validUntil: Date | null }>,
  now: Date,
): { stale: number; revalidate: number; expire: number } | null {
  let earliest: number | null = null;
  for (const offer of offers) {
    const at = offer.validUntil?.getTime();
    if (at !== undefined && at >= now.getTime() && (earliest === null || at < earliest)) earliest = at;
  }
  if (earliest === null) return null;
  const secondsLeft = Math.ceil((earliest - now.getTime()) / 1000) + 1;
  if (secondsLeft >= HOURS_PROFILE.revalidate) return null;
  return { ...HOURS_PROFILE, revalidate: Math.max(MIN_OFFER_REVALIDATE_SECONDS, secondsLeft) };
}

/**
 * Everything the landing page needs, localized for `locale`.
 *
 * Cached with the Next 16 Cache Components API: `"use cache"` + cacheTag("content")
 * + cacheLife("hours", shortened before the earliest offer expiry — offerExpiryCacheLife).
 * The locale argument is part of the cache key. Invalidate
 * with revalidateContent() (Server Actions) / revalidateContentFromRoute() (Route Handlers).
 */
export async function getLanding(locale: Locale): Promise<LandingContent> {
  "use cache";
  cacheTag(CACHE_TAGS.content);

  const now = new Date();

  const [blocks, collections, reviews, news, gallery, offers, partners, settings] = await Promise.all([
    db.contentBlock.findMany({
      select: { key: true, value: true, media: { select: mediaSelect } },
    }),
    queryCollections({ published: true }),
    db.review.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: LIMITS.reviews,
      select: { id: true, author: true, role: true, text: true, rating: true, avatar: { select: mediaSelect } },
    }),
    db.newsItem.findMany({
      where: { published: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: LIMITS.news,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        body: true,
        date: true,
        image: { select: mediaSelect },
      },
    }),
    db.galleryItem.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      take: LIMITS.gallery,
      select: { id: true, caption: true, media: { select: mediaSelect } },
    }),
    db.offer.findMany({
      where: { published: true, OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      take: LIMITS.offers,
      select: {
        id: true,
        title: true,
        text: true,
        badge: true,
        ctaLabel: true,
        ctaHref: true,
        validUntil: true,
        image: { select: mediaSelect },
      },
    }),
    db.partner.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      take: LIMITS.partners,
      select: { id: true, name: true, url: true, description: true, logo: { select: mediaSelect } },
    }),
    loadSettings(locale),
  ]);

  // Nothing invalidates the cache when an offer's validUntil passes, so the entry must not
  // outlive the earliest expiry (otherwise an expired offer stays up to an hour).
  // Exactly one cacheLife() call per invocation (Next.js docs).
  const offerLife = offerExpiryCacheLife(offers, now);
  if (offerLife) cacheLife(offerLife);
  else cacheLife(CONTENT_CACHE_LIFE);

  const blockByKey = new Map(blocks.map((block) => [block.key, block]));
  if (process.env.NODE_ENV !== "production") {
    const missing = TEXT_KEYS.filter((key) => !blockByKey.has(key));
    if (missing.length > 0) console.warn(`[content] no DB rows for ${missing.join(", ")} — default copy shown; run npm run db:seed`);
  }

  return {
    locale,
    texts: recordFromKeys(TEXT_KEYS, (key) => blockText(key, blockByKey.get(key), locale)),
    images: recordFromKeys(IMAGE_KEYS, (key) => toImageRef(blockByKey.get(key)?.media, locale)),
    collections: collections.map((row) => toCollectionView(row, locale)),
    reviews: reviews.map(
      (row): ReviewView => ({
        id: row.id,
        author: row.author,
        role: readText(row.role, locale),
        text: readText(row.text, locale),
        avatar: toImageRef(row.avatar, locale),
        rating: row.rating,
      }),
    ),
    news: news.map(
      (row): NewsView => ({
        id: row.id,
        slug: row.slug,
        title: readText(row.title, locale),
        excerpt: readText(row.excerpt, locale),
        body: readText(row.body, locale),
        date: row.date.toISOString(),
        image: toImageRef(row.image, locale),
      }),
    ),
    gallery: gallery.flatMap((row): GalleryView[] => {
      const image = toImageRef(row.media, locale);
      return image ? [{ id: row.id, caption: readText(row.caption, locale), image }] : [];
    }),
    offers: offers.map(
      (row): OfferView => ({
        id: row.id,
        title: readText(row.title, locale),
        text: readText(row.text, locale),
        badge: readText(row.badge, locale),
        ctaLabel: readText(row.ctaLabel, locale),
        ctaHref: row.ctaHref,
        validUntil: row.validUntil ? row.validUntil.toISOString() : null,
        image: toImageRef(row.image, locale),
      }),
    ),
    partners: partners.map(
      (row): PartnerView => ({
        id: row.id,
        name: row.name,
        url: row.url,
        description: readText(row.description, locale),
        logo: toImageRef(row.logo, locale),
      }),
    ),
    settings,
    year: now.getFullYear(),
  };
}

/** Site settings only (contacts, socials, SEO defaults) — for generateMetadata, JSON-LD, footer. */
export async function getSiteSettings(locale: Locale): Promise<SettingsView> {
  "use cache";
  cacheTag(CACHE_TAGS.content);
  cacheLife(CONTENT_CACHE_LIFE);
  return loadSettings(locale);
}

/** One published collection with its published products, or null (→ notFound()). */
export async function getCollectionBySlug(locale: Locale, slug: string): Promise<CollectionView | null> {
  "use cache";
  cacheTag(CACHE_TAGS.content);
  cacheLife(CONTENT_CACHE_LIFE);
  const [row] = await queryCollections({ published: true, slug });
  return row ? toCollectionView(row, locale) : null;
}

/** Slugs of published collections — for generateStaticParams and sitemap.xml. */
export async function getPublishedCollectionSlugs(): Promise<string[]> {
  "use cache";
  cacheTag(CACHE_TAGS.content);
  cacheLife(CONTENT_CACHE_LIFE);
  const rows = await db.collection.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { slug: true },
  });
  return rows.map((row) => row.slug);
}
