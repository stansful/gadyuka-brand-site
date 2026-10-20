import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { updatedAt: Date; published?: boolean };
type MediaRow = { updatedAt: Date };
type ProductRow = Row & { images: MediaRow[] };
type CollectionRow = Row & { slug: string; cover: MediaRow | null; products: ProductRow[] };
type Where = { published?: boolean } | undefined;

/**
 * In-memory stand-in for the Prisma calls of getSitemapData: honours `where.published` (top level
 * and on the nested products), so a query that filters hidden rows out behaves as it would on the DB.
 */
const store = vi.hoisted(() => ({
  message: [] as Row[],
  contentImage: [] as Row[],
  menuItem: [] as Row[],
  socialLink: [] as Row[],
  settings: null as Row | null,
  media: [] as Row[],
  review: [] as Row[],
  newsItem: [] as Row[],
  galleryItem: [] as Row[],
  offer: [] as Row[],
  partner: [] as Row[],
  collection: [] as CollectionRow[],
}));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/content', () => ({ CACHE_TAGS: { content: 'content' }, CONTENT_CACHE_LIFE: 'hours' }));
vi.mock('@/lib/db', () => {
  const matches = (row: Row, where: Where): boolean =>
    where?.published === undefined || row.published === where.published;
  const maxUpdatedAt = (rows: readonly Row[], where: Where): Date | null =>
    rows
      .filter(row => matches(row, where))
      .reduce<Date | null>((max, row) => (!max || row.updatedAt > max ? row.updatedAt : max), null);
  const model = (rows: () => readonly Row[]) => ({
    aggregate: async (args: { where?: Where }) => ({ _max: { updatedAt: maxUpdatedAt(rows(), args.where) } }),
  });
  type CollectionArgs = { where?: Where; select: { products?: { where?: Where } } };
  return {
    db: {
      message: model(() => store.message),
      contentImage: model(() => store.contentImage),
      menuItem: model(() => store.menuItem),
      socialLink: model(() => store.socialLink),
      siteSettings: { findUnique: async () => store.settings },
      media: model(() => store.media),
      review: model(() => store.review),
      newsItem: model(() => store.newsItem),
      galleryItem: model(() => store.galleryItem),
      offer: model(() => store.offer),
      partner: model(() => store.partner),
      product: model(() => store.collection.flatMap(collection => collection.products)),
      collection: {
        ...model(() => store.collection),
        findMany: async (args: CollectionArgs) =>
          store.collection
            .filter(row => matches(row, args.where))
            .map(row => ({
              slug: row.slug,
              updatedAt: row.updatedAt,
              cover: row.cover,
              products: row.products
                .filter(product => matches(product, args.select.products?.where))
                .map(product => ({
                  updatedAt: product.updatedAt,
                  images: product.images.map(media => ({ media })),
                })),
            })),
      },
    },
  };
});

const { getSitemapData, toSitemapData } = await import('./sitemap-data');

/** Day `n` of October 2026 (later day = later change). */
const day = (n: number): Date => new Date(Date.UTC(2026, 9, n));
const iso = (n: number): string => day(n).toISOString();

function seed(): void {
  store.message = [{ updatedAt: day(1) }];
  store.contentImage = [{ updatedAt: day(1) }];
  store.menuItem = [{ updatedAt: day(1), published: true }];
  store.socialLink = [{ updatedAt: day(1), published: true }];
  store.settings = { updatedAt: day(1) };
  store.media = [{ updatedAt: day(1) }];
  store.review = [{ updatedAt: day(1), published: true }];
  store.newsItem = [{ updatedAt: day(2), published: true }];
  store.galleryItem = [];
  store.offer = [];
  store.partner = [];
  store.collection = [
    {
      slug: 'noir',
      updatedAt: day(2),
      published: true,
      cover: { updatedAt: day(1) },
      products: [{ updatedAt: day(3), published: true, images: [{ updatedAt: day(1) }] }],
    },
    {
      slug: 'drop',
      updatedAt: day(2),
      published: true,
      cover: null,
      products: [{ updatedAt: day(2), published: true, images: [] }],
    },
    { slug: 'draft', updatedAt: day(4), published: false, cover: null, products: [] },
  ];
}

const lastModifiedOf = async (slug: string): Promise<string | undefined> =>
  (await getSitemapData()).collections.find(row => row.slug === slug)?.lastModified;

describe('sitemap lastmod', () => {
  beforeEach(seed);

  it('lists published collections with the latest change of the collection page', async () => {
    const data = await getSitemapData();
    expect(data.collections).toEqual([
      { slug: 'noir', lastModified: iso(3) },
      { slug: 'drop', lastModified: iso(2) },
    ]);
    // A hidden collection still changes the landing (it was listed there before it was hidden).
    expect(data.landingLastModified).toBe(iso(4));
  });

  it('moves every collection page with the messages, menu, social links and settings they render', async () => {
    store.message.push({ updatedAt: day(10) }); // e.g. catalog.breadcrumbCatalog
    expect(await lastModifiedOf('noir')).toBe(iso(10));
    expect(await lastModifiedOf('drop')).toBe(iso(10));

    seed();
    store.menuItem.push({ updatedAt: day(11), published: true });
    expect(await lastModifiedOf('drop')).toBe(iso(11));

    seed();
    store.socialLink[0] = { updatedAt: day(12), published: true };
    expect(await lastModifiedOf('drop')).toBe(iso(12));

    seed();
    store.settings = { updatedAt: day(13) };
    expect(await lastModifiedOf('drop')).toBe(iso(13));
  });

  it('does not move collection pages for landing-only rows', async () => {
    store.newsItem.push({ updatedAt: day(10), published: true });
    store.contentImage.push({ updatedAt: day(10) });
    const data = await getSitemapData();
    expect(data.landingLastModified).toBe(iso(10));
    expect(data.collections.map(row => row.lastModified)).toEqual([iso(3), iso(2)]);
  });

  it('moves only the collection whose cover or product image (alt text) changed', async () => {
    const noir = store.collection[0];
    if (!noir?.cover) throw new Error('fixture');
    noir.cover.updatedAt = day(10);
    expect(await lastModifiedOf('noir')).toBe(iso(10));
    expect(await lastModifiedOf('drop')).toBe(iso(2));

    seed();
    const image = store.collection[0]?.products[0]?.images[0];
    if (!image) throw new Error('fixture');
    image.updatedAt = day(11);
    expect(await lastModifiedOf('noir')).toBe(iso(11));
  });

  it('moves forward, never back, when a row is hidden', async () => {
    // The admin edits the only product of «drop» (day 9), then hides it (day 10).
    const product = store.collection[1]?.products[0];
    if (!product) throw new Error('fixture');
    product.updatedAt = day(9);
    expect(await lastModifiedOf('drop')).toBe(iso(9));
    product.published = false;
    product.updatedAt = day(10);
    expect(await lastModifiedOf('drop')).toBe(iso(10));

    seed();
    // Hiding the latest news item / a menu item changes the landing.
    store.newsItem[0] = { updatedAt: day(10), published: false };
    expect((await getSitemapData()).landingLastModified).toBe(iso(10));
    store.menuItem[0] = { updatedAt: day(11), published: false };
    const data = await getSitemapData();
    expect(data.landingLastModified).toBe(iso(11));
    expect(data.collections.map(row => row.lastModified)).toEqual([iso(11), iso(11)]);
  });

  it('keeps the landing at or after every collection page', () => {
    const data = toSitemapData({
      shared: [day(1)],
      landing: [null, undefined],
      collections: [{ slug: 'noir', updatedAt: day(5), cover: null, products: [] }],
    });
    expect(data).toEqual({ landingLastModified: iso(5), collections: [{ slug: 'noir', lastModified: iso(5) }] });
  });

  it('has no landing lastmod and no collections on an empty DB', () => {
    expect(toSitemapData({ shared: [null, undefined], landing: [null], collections: [] })).toEqual({
      landingLastModified: null,
      collections: [],
    });
  });
});
