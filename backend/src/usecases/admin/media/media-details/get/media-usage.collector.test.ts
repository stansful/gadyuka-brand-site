import { deepStrictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { MediaUsageRows } from './media-details.repository';
import { MediaUsageCollector } from './media-usage.collector';

const NO_USAGES: MediaUsageRows = {
  contentImages: [],
  collectionCovers: [],
  productImages: [],
  reviewAvatars: [],
  newsImages: [],
  galleryItems: [],
  offerImages: [],
  partnerLogos: [],
  ogImageSettings: [],
};

function rowsWith(overrides: Partial<MediaUsageRows>): MediaUsageRows {
  return { ...NO_USAGES, ...overrides };
}

describe('MediaUsageCollector', () => {
  const collector = new MediaUsageCollector();

  it('lists the places in kind order (landing images first, the settings last), with their admin pages', () => {
    const usages = collector.collect(
      rowsWith({
        ogImageSettings: [{ id: 1 }],
        partnerLogos: [{ id: 'p1', name: 'Ателье' }],
        contentImages: [{ key: 'about.image' }, { key: 'tailoring.image' }],
        productImages: [{ product: { id: 'pr1', title: { ru: 'Худи', en: 'Hoodie' } } }],
      }),
    );
    deepStrictEqual(
      usages.map(usage => ({ ...usage })),
      [
        { kind: 'landingImage', href: '/admin/content?section=about', title: '', contentKey: 'about.image' },
        { kind: 'landingImage', href: '/admin/content?section=tailoring', title: '', contentKey: 'tailoring.image' },
        { kind: 'productPhoto', href: '/admin/products/pr1', title: 'Худи', contentKey: null },
        { kind: 'partnerLogo', href: '/admin/partners/p1', title: 'Ателье', contentKey: null },
        { kind: 'settings', href: '/admin/settings', title: '', contentKey: null },
      ],
    );
  });

  it('titles rows by their stored default-locale text, trimmed ("" when missing)', () => {
    const usages = collector.collect(
      rowsWith({
        collectionCovers: [{ id: 'c1', title: { ru: '  Меня запомнят ' } }],
        newsImages: [{ id: 'n1', title: { en: 'Only English' } }],
        galleryItems: [{ id: 'g1', caption: {} }],
        offerImages: [{ id: 'o1', title: 'malformed' }],
        reviewAvatars: [{ id: 'r1', author: 'Анна' }],
      }),
    );
    deepStrictEqual(
      usages.map(usage => [usage.kind, usage.href, usage.title]),
      [
        ['collectionCover', '/admin/collections/c1', 'Меня запомнят'],
        ['reviewAvatar', '/admin/reviews/r1', 'Анна'],
        ['news', '/admin/news/n1', ''],
        ['gallery', '/admin/gallery/g1', ''],
        ['offer', '/admin/offers/o1', ''],
      ],
    );
  });

  it('encodes the section of an odd landing image key and lists nothing for an unused file', () => {
    deepStrictEqual(
      collector.collect(rowsWith({ contentImages: [{ key: 'a b&c.image' }] }))[0]?.href,
      '/admin/content?section=a%20b%26c',
    );
    deepStrictEqual(collector.collect(rowsWith({})), []);
  });
});
