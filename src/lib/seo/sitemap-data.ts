import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS, CONTENT_CACHE_LIFE } from "@/lib/content";

export type SitemapData = {
  /** ISO time of the latest change of anything shown on the landing; null on an empty DB. */
  landingLastModified: string | null;
  /** Published collections with the latest change of the collection or its products. */
  collections: Array<{ slug: string; lastModified: string }>;
};

function latest(dates: ReadonlyArray<Date | null | undefined>): Date | null {
  let max: Date | null = null;
  for (const date of dates) if (date && (!max || date > max)) max = date;
  return max;
}

/**
 * Data for sitemap.xml. Cached like the rest of the public content ("use cache" +
 * cacheTag("content")), so admin saves (revalidateContent) refresh it too.
 */
export async function getSitemapData(): Promise<SitemapData> {
  "use cache";
  cacheTag(CACHE_TAGS.content);
  cacheLife(CONTENT_CACHE_LIFE);

  const [blocks, settings, media, reviews, news, gallery, offers, partners, collections, products] = await Promise.all([
    db.contentBlock.aggregate({ _max: { updatedAt: true } }),
    db.siteSettings.findUnique({ where: { id: 1 }, select: { updatedAt: true } }),
    db.media.aggregate({ _max: { updatedAt: true } }),
    db.review.aggregate({ where: { published: true }, _max: { updatedAt: true } }),
    db.newsItem.aggregate({ where: { published: true }, _max: { updatedAt: true } }),
    db.galleryItem.aggregate({ where: { published: true }, _max: { updatedAt: true } }),
    db.offer.aggregate({ where: { published: true }, _max: { updatedAt: true } }),
    db.partner.aggregate({ where: { published: true }, _max: { updatedAt: true } }),
    db.collection.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      take: 200,
      select: { id: true, slug: true, updatedAt: true },
    }),
    db.product.groupBy({ by: ["collectionId"], where: { published: true }, _max: { updatedAt: true } }),
  ]);

  const productsByCollection = new Map(products.map((row) => [row.collectionId, row._max.updatedAt]));
  const collectionRows = collections.map((row) => ({
    slug: row.slug,
    lastModified: latest([row.updatedAt, productsByCollection.get(row.id)]) ?? row.updatedAt,
  }));

  const landing = latest([
    blocks._max.updatedAt,
    settings?.updatedAt,
    media._max.updatedAt,
    reviews._max.updatedAt,
    news._max.updatedAt,
    gallery._max.updatedAt,
    offers._max.updatedAt,
    partners._max.updatedAt,
    ...collectionRows.map((row) => row.lastModified),
  ]);

  return {
    landingLastModified: landing ? landing.toISOString() : null,
    collections: collectionRows.map((row) => ({ slug: row.slug, lastModified: row.lastModified.toISOString() })),
  };
}
