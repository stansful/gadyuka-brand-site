import 'server-only';
import { publicRead } from '@/lib/api/public';
import type { SitemapResponse } from '@shared/contracts/content';

export type SitemapData = {
  /** ISO time of the latest change of anything shown on the landing; null on an empty database. */
  landingLastModified: string | null;
  /** Published collections with the latest change of anything shown on the collection page. */
  collections: Array<{ slug: string; lastModified: string }>;
};

/**
 * Data for sitemap.xml: the backend's GET /api/v1/public/sitemap (lastmod of a page = the latest
 * updatedAt of the rows it renders — hidden rows included, so hiding one moves lastmod forward;
 * the rules live in the backend, SitemapLastModified). Read at request time and cached like the rest
 * of the public content (publicRead: cacheTag('content'), so admin saves refresh it too).
 */
export async function getSitemapData(): Promise<SitemapData> {
  const response = await publicRead<SitemapResponse>('/api/v1/public/sitemap');
  return {
    landingLastModified: response.landingLastModified,
    collections: response.collections.map(page => ({ slug: page.slug, lastModified: page.lastModified })),
  };
}
