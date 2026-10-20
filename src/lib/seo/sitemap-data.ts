import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

import { CACHE_TAGS, CONTENT_CACHE_LIFE } from '@/lib/content';
import { db } from '@/lib/db';

export type SitemapData = {
  /** ISO time of the latest change of anything shown on the landing; null on an empty DB. */
  landingLastModified: string | null;
  /** Published collections with the latest change of anything shown on the collection page. */
  collections: Array<{ slug: string; lastModified: string }>;
};

/** Upper bound of the collection pages listed (far above what the catalog holds). */
const MAX_COLLECTIONS = 200;

type Timestamp = Date | null | undefined;

function latest(dates: ReadonlyArray<Timestamp>): Date | null {
  let max: Date | null = null;
  for (const date of dates) if (date && (!max || date > max)) max = date;
  return max;
}

/** What the collection query returns: the timestamps of everything one collection page renders. */
export type SitemapCollectionRow = {
  slug: string;
  updatedAt: Date;
  cover: { updatedAt: Date } | null;
  products: ReadonlyArray<{ updatedAt: Date; images: ReadonlyArray<{ media: { updatedAt: Date } }> }>;
};

export type SitemapRows = {
  /** Latest change of what every page renders: site messages, the menu, social links, settings. */
  shared: ReadonlyArray<Timestamp>;
  /** Latest change of what only the landing renders (sections, landing images, all collections …). */
  landing: ReadonlyArray<Timestamp>;
  /** Published collections (the collection pages). */
  collections: ReadonlyArray<SitemapCollectionRow>;
};

/** Folds the timestamps into lastmod values: the landing and each collection page. */
export function toSitemapData({ shared, landing, collections }: SitemapRows): SitemapData {
  const sharedLastModified = latest(shared);
  const collectionRows = collections.map(row => ({
    slug: row.slug,
    lastModified:
      latest([
        sharedLastModified,
        row.updatedAt,
        row.cover?.updatedAt,
        ...row.products.flatMap(product => [product.updatedAt, ...product.images.map(image => image.media.updatedAt)]),
      ]) ?? row.updatedAt,
  }));
  const landingLastModified = latest([sharedLastModified, ...landing, ...collectionRows.map(row => row.lastModified)]);
  return {
    landingLastModified: landingLastModified ? landingLastModified.toISOString() : null,
    collections: collectionRows.map(row => ({ slug: row.slug, lastModified: row.lastModified.toISOString() })),
  };
}

/**
 * Data for sitemap.xml. Cached like the rest of the public content ("use cache" +
 * cacheTag("content")), so admin saves (revalidateContent) refresh it too.
 *
 * lastmod of a page = the latest updatedAt of the rows it renders:
 *  - every page (the header, footer, breadcrumbs and JSON-LD of getLanding): site messages,
 *    the menu, social links and settings;
 *  - the landing: also landing images, media, the sections' rows, collections and products;
 *  - a collection page: also the collection, its cover, its products and their images' media.
 * Hidden rows count too: hiding one (setPublished) bumps its updatedAt and changes the pages,
 * while a `published: true` filter would drop it and move lastmod back (editing a draft moves
 * lastmod as well — at worst one needless recrawl). A deleted row leaves no timestamp behind.
 */
export async function getSitemapData(): Promise<SitemapData> {
  'use cache';
  cacheTag(CACHE_TAGS.content);
  cacheLife(CONTENT_CACHE_LIFE);

  const [
    messages,
    menu,
    socials,
    settings,
    contentImages,
    media,
    reviews,
    news,
    gallery,
    offers,
    partners,
    allCollections,
    allProducts,
    collections,
  ] = await Promise.all([
    db.message.aggregate({ _max: { updatedAt: true } }),
    db.menuItem.aggregate({ _max: { updatedAt: true } }),
    db.socialLink.aggregate({ _max: { updatedAt: true } }),
    db.siteSettings.findUnique({ where: { id: 1 }, select: { updatedAt: true } }),
    db.contentImage.aggregate({ _max: { updatedAt: true } }),
    db.media.aggregate({ _max: { updatedAt: true } }),
    db.review.aggregate({ _max: { updatedAt: true } }),
    db.newsItem.aggregate({ _max: { updatedAt: true } }),
    db.galleryItem.aggregate({ _max: { updatedAt: true } }),
    db.offer.aggregate({ _max: { updatedAt: true } }),
    db.partner.aggregate({ _max: { updatedAt: true } }),
    db.collection.aggregate({ _max: { updatedAt: true } }),
    db.product.aggregate({ _max: { updatedAt: true } }),
    db.collection.findMany({
      where: { published: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      take: MAX_COLLECTIONS,
      select: {
        slug: true,
        updatedAt: true,
        cover: { select: { updatedAt: true } },
        products: {
          select: { updatedAt: true, images: { select: { media: { select: { updatedAt: true } } } } },
        },
      },
    }),
  ]);

  return toSitemapData({
    shared: [messages._max.updatedAt, menu._max.updatedAt, socials._max.updatedAt, settings?.updatedAt],
    landing: [
      contentImages._max.updatedAt,
      media._max.updatedAt,
      reviews._max.updatedAt,
      news._max.updatedAt,
      gallery._max.updatedAt,
      offers._max.updatedAt,
      partners._max.updatedAt,
      allCollections._max.updatedAt,
      allProducts._max.updatedAt,
    ],
    collections,
  });
}
