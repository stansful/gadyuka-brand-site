import { ApiProperty } from '@nestjs/swagger';

import type { SitemapCollection, SitemapResponse as SitemapResponseContract } from '~shared/contracts/content';

import { CollectionPageLastModified } from '~core/public-content/sitemap-last-modified';

import { SitemapCollectionView } from './sitemap-collection.view';

/** Answer of GET /public/sitemap: lastmod of the landing and of every published collection page. */
export class SitemapResponse implements SitemapResponseContract {
  @ApiProperty({ type: String, nullable: true, description: 'ISO 8601; null on an empty database' })
  landingLastModified: string | null;

  @ApiProperty({ type: () => [SitemapCollectionView], description: 'In the admin order (at most 200)' })
  collections: SitemapCollection[];

  static of(landing: Date | null, collections: readonly CollectionPageLastModified[]): SitemapResponse {
    return Object.assign(new SitemapResponse(), {
      landingLastModified: landing === null ? null : landing.toISOString(),
      collections: collections.map(page => ({ slug: page.slug, lastModified: page.lastModified.toISOString() })),
    });
  }
}
