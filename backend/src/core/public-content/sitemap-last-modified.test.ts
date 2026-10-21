import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { CollectionPageChanges, ContentLastChanges, SitemapLastModified } from './sitemap-last-modified';

/** Day `n` of October 2026 (a later day = a later change). */
const day = (n: number): Date => new Date(Date.UTC(2026, 9, n));

const collectionPage = (slug: string, changes: Partial<CollectionPageChanges> = {}): CollectionPageChanges => ({
  slug,
  updatedAt: day(2),
  coverUpdatedAt: null,
  productsUpdatedAt: null,
  imagesUpdatedAt: null,
  ...changes,
});

const EMPTY: ContentLastChanges = {
  messages: null,
  menuItems: null,
  socialLinks: null,
  settings: null,
  contentImages: null,
  media: null,
  reviews: null,
  news: null,
  gallery: null,
  offers: null,
  partners: null,
  collections: null,
  products: null,
};

/** The fixture of the frontend's sitemap test: noir (product day 3), drop (day 2), a hidden draft (day 4). */
const content = (changes: Partial<ContentLastChanges> = {}): ContentLastChanges => ({
  ...EMPTY,
  messages: day(1),
  menuItems: day(1),
  socialLinks: day(1),
  settings: day(1),
  contentImages: day(1),
  media: day(1),
  reviews: day(1),
  news: day(2),
  collections: day(4),
  products: day(3),
  ...changes,
});

const pages = (): CollectionPageChanges[] => [
  collectionPage('noir', { coverUpdatedAt: day(1), productsUpdatedAt: day(3), imagesUpdatedAt: day(1) }),
  collectionPage('drop', { productsUpdatedAt: day(2) }),
];

function lastModifiedOf(sitemap: SitemapLastModified, slug: string): Date | undefined {
  return sitemap.collectionPages().find(page => page.slug === slug)?.lastModified;
}

describe('SitemapLastModified (lastmod of the public pages)', () => {
  it('dates each collection page by the latest change of what it renders', () => {
    const sitemap = SitemapLastModified.of(content(), pages());
    deepStrictEqual(sitemap.collectionPages(), [
      { slug: 'noir', lastModified: day(3) },
      { slug: 'drop', lastModified: day(2) },
    ]);
    // A hidden collection still changes the landing (it was listed there before it was hidden).
    deepStrictEqual(sitemap.findLanding(), day(4));
  });

  it('moves every collection page with the messages, menu, social links and settings they render', () => {
    for (const shared of ['messages', 'menuItems', 'socialLinks', 'settings'] as const) {
      const sitemap = SitemapLastModified.of(content({ [shared]: day(10) }), pages());
      deepStrictEqual(lastModifiedOf(sitemap, 'noir'), day(10), shared);
      deepStrictEqual(lastModifiedOf(sitemap, 'drop'), day(10), shared);
    }
  });

  it('does not move collection pages for landing-only rows', () => {
    for (const landing of ['contentImages', 'media', 'reviews', 'news', 'gallery', 'offers', 'partners'] as const) {
      const sitemap = SitemapLastModified.of(content({ [landing]: day(10) }), pages());
      deepStrictEqual(sitemap.findLanding(), day(10), landing);
      deepStrictEqual(
        sitemap.collectionPages().map(page => page.lastModified),
        [day(3), day(2)],
        landing,
      );
    }
  });

  it('moves only the collection whose cover or product image (alt text) changed', () => {
    const [noir, drop] = pages();
    const withCover = SitemapLastModified.of(content(), [{ ...noir, coverUpdatedAt: day(10) }, drop]);
    deepStrictEqual(lastModifiedOf(withCover, 'noir'), day(10));
    deepStrictEqual(lastModifiedOf(withCover, 'drop'), day(2));
    const withImage = SitemapLastModified.of(content(), [{ ...noir, imagesUpdatedAt: day(11) }, drop]);
    deepStrictEqual(lastModifiedOf(withImage, 'noir'), day(11));
  });

  it('keeps the landing at or after every collection page', () => {
    const sitemap = new SitemapLastModified({
      shared: [day(1)],
      landing: [null, undefined],
      collections: [collectionPage('noir', { updatedAt: day(5) })],
    });
    deepStrictEqual(sitemap.findLanding(), day(5));
    deepStrictEqual(sitemap.collectionPages(), [{ slug: 'noir', lastModified: day(5) }]);
  });

  it('has no landing lastmod and no collection pages on an empty database', () => {
    const sitemap = SitemapLastModified.of(EMPTY, []);
    strictEqual(sitemap.findLanding(), null);
    deepStrictEqual(sitemap.collectionPages(), []);
  });

  it('picks the latest of the known times', () => {
    deepStrictEqual(SitemapLastModified.latest([day(3), null, day(5), undefined, day(4)]), day(5));
    strictEqual(SitemapLastModified.latest([null, undefined]), null);
  });
});
