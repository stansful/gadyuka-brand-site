/**
 * Public site content (port of the frontend's src/lib/content/landing.ts and src/lib/seo/sitemap-data.ts).
 *
 * Upper bounds of the public lists: the site never renders unbounded queries. A list longer than
 * its bound shows its first rows in the admin's order.
 */
export const PUBLIC_LIST_LIMITS = {
  collections: 20,
  productsPerCollection: 48,
  /** = the admin's maximum of photos per product (the form refuses more) */
  productImages: 30,
  reviews: 30,
  news: 12,
  gallery: 60,
  offers: 12,
  partners: 40,
  menu: 30,
  socials: 20,
  /** ContentImage rows (one per landing image slot: a handful) */
  contentImages: 50,
  /** Collection pages of sitemap.xml (far above what the catalog holds) */
  sitemapCollections: 200,
  /** Slugs of GET /public/collections (same bound as the sitemap) */
  collectionSlugs: 200,
} as const;
