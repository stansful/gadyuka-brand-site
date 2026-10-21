import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SitemapResponse } from '@shared/contracts/content';

/**
 * sitemap.xml from the backend's GET /public/sitemap. The lastmod rules themselves (shared rows move
 * every page, landing-only rows only the landing, hidden rows count, …) are tested in the backend:
 * SitemapLastModified (unit) and GET /public/sitemap (e2e).
 */
const publicRead = vi.hoisted(() => vi.fn<(path: string) => Promise<SitemapResponse>>());
vi.mock('@/lib/api/public', () => ({ publicRead }));

const { getSitemapData } = await import('./sitemap-data');
const { default: sitemap } = await import('@/app/sitemap');

const answer: SitemapResponse = {
  landingLastModified: '2026-10-04T00:00:00.000Z',
  collections: [
    { slug: 'noir', lastModified: '2026-10-03T00:00:00.000Z' },
    { slug: 'drop', lastModified: '2026-10-02T00:00:00.000Z' },
  ],
};

beforeEach(() => {
  publicRead.mockReset().mockResolvedValue(answer);
  vi.stubEnv('SITE_URL', 'https://gadyuka.example');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getSitemapData', () => {
  it('reads the lastmod values of the backend (request time, cached with the content)', async () => {
    expect(await getSitemapData()).toEqual(answer);
    expect(publicRead).toHaveBeenCalledWith('/api/v1/public/sitemap');
  });
});

describe('sitemap.xml', () => {
  it('lists the landing and every published collection page in every locale, with their lastmod', async () => {
    const entries = await sitemap();
    expect(entries.map(entry => [entry.url, entry.lastModified])).toEqual([
      ['https://gadyuka.example', answer.landingLastModified],
      ['https://gadyuka.example/en', answer.landingLastModified],
      ['https://gadyuka.example/catalog/noir', '2026-10-03T00:00:00.000Z'],
      ['https://gadyuka.example/en/catalog/noir', '2026-10-03T00:00:00.000Z'],
      ['https://gadyuka.example/catalog/drop', '2026-10-02T00:00:00.000Z'],
      ['https://gadyuka.example/en/catalog/drop', '2026-10-02T00:00:00.000Z'],
    ]);
    expect(entries[0]?.alternates?.languages).toMatchObject({
      ru: 'https://gadyuka.example',
      en: 'https://gadyuka.example/en',
    });
  });

  it('has no landing lastmod and no collection pages on an empty database', async () => {
    publicRead.mockResolvedValue({ landingLastModified: null, collections: [] });
    const entries = await sitemap();
    expect(entries).toHaveLength(2);
    expect(entries.every(entry => entry.lastModified === undefined)).toBe(true);
  });
});
