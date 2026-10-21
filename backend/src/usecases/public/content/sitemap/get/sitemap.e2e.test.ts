import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';

import type { SitemapResponse } from '~shared/contracts/content';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { PublicContentFixtures } from '~usecases/public/content/common/test/public-content-fixtures';

import { SITEMAP_ROUTE } from './sitemap.route';

/**
 * Day `n` of a far future month: rows of this file are dated after anything else in a shared test
 * database, so the lastmod values are theirs (the fixture of the frontend's sitemap test).
 */
const day = (n: number): Date => new Date(Date.UTC(2100, 0, n));
const iso = (n: number): string => day(n).toISOString();
/** Far below anything else in a shared test database: these collections are listed first. */
const FIRST = -1_000_000;

describe('[e2e] GET /api/v1/public/sitemap', () => {
  let app: TestApp;
  let owner: TestAdmin;
  let fixtures: PublicContentFixtures;
  let rows: { slugs: [string, string]; noirCover: string; noirImage: string; dropProduct: string };

  before(async () => {
    app = await TestApp.start();
    owner = await TestAdmin.create(app.database);
  });

  beforeEach(async () => {
    await fixtures?.remove();
    fixtures = new PublicContentFixtures(app.database, owner.id);
    rows = await seed();
  });

  after(async () => {
    await fixtures.remove();
    await owner.remove();
    await app.stop();
  });

  /** noir: cover day 1, product day 3 (image day 1); drop: product day 2; draft: hidden, day 4. */
  async function seed(): Promise<typeof rows> {
    const noirCover = await fixtures.createMedia({ updatedAt: day(1) });
    const noirImage = await fixtures.createMedia({ updatedAt: day(1) });
    const slugs: [string, string] = [fixtures.nextSlug(), fixtures.nextSlug()];
    const noir = await fixtures.createCollection(collection({ slug: slugs[0], coverId: noirCover }));
    const noirProduct = await fixtures.createProduct(noir, { published: true, updatedAt: day(3) });
    await fixtures.createProductImage(noirProduct, noirImage, 0);
    const drop = await fixtures.createCollection(collection({ slug: slugs[1], order: FIRST + 1 }));
    const dropProduct = await fixtures.createProduct(drop, { published: true, updatedAt: day(2) });
    await fixtures.createCollection({ order: FIRST, published: false, updatedAt: day(4) });
    return { slugs, noirCover, noirImage, dropProduct };
  }

  function collection(changes: { slug: string; coverId?: string; order?: number }) {
    return { order: FIRST, published: true, updatedAt: day(2), ...changes };
  }

  async function sitemap(): Promise<SitemapResponse> {
    const response = await app.api.get<SitemapResponse>(SITEMAP_ROUTE);
    strictEqual(response.status, 200);
    return response.body;
  }

  /** lastmod of this file's collection pages (noir, drop), as the sitemap lists them. */
  function pagesOf(body: SitemapResponse): string[] {
    return body.collections.filter(page => rows.slugs.includes(page.slug)).map(page => page.lastModified);
  }

  async function pages(): Promise<string[]> {
    return pagesOf(await sitemap());
  }

  it('lists published collections with the latest change of the collection page', async () => {
    const body = await sitemap();
    deepStrictEqual(
      body.collections.filter(page => rows.slugs.includes(page.slug)).map(page => page.slug),
      rows.slugs,
      'in the admin order, without the hidden collection',
    );
    deepStrictEqual(pagesOf(body), [iso(3), iso(2)]);
    // A hidden collection still changes the landing (it was listed there before it was hidden).
    strictEqual(body.landingLastModified, iso(4));
  });

  it('moves every collection page with the menu, social links and messages they render', async () => {
    await fixtures.createMenuItem({ updatedAt: day(11), published: false });
    deepStrictEqual(await pages(), [iso(11), iso(11)]);
    await fixtures.createSocialLink({ updatedAt: day(12) });
    deepStrictEqual(await pages(), [iso(12), iso(12)]);
  });

  it('does not move collection pages for landing-only rows', async () => {
    await fixtures.createNews({ updatedAt: day(10), published: true });
    const media = await fixtures.createMedia({ updatedAt: day(9) });
    await fixtures.createContentImage(media);
    const body = await sitemap();
    strictEqual(body.landingLastModified, iso(10));
    deepStrictEqual(pagesOf(body), [iso(3), iso(2)]);
  });

  it('moves only the collection whose cover or product image (alt text) changed', async () => {
    await app.database.client.media.update({ where: { id: rows.noirCover }, data: { updatedAt: day(10) } });
    deepStrictEqual(await pages(), [iso(10), iso(2)]);
    await app.database.client.media.update({ where: { id: rows.noirImage }, data: { updatedAt: day(11) } });
    deepStrictEqual(await pages(), [iso(11), iso(2)]);
  });

  it('moves forward, never back, when a row is hidden', async () => {
    // The admin edits the only product of «drop» (day 9), then hides it (day 10).
    const product = app.database.client.product;
    await product.update({ where: { id: rows.dropProduct }, data: { updatedAt: day(9) } });
    deepStrictEqual(await pages(), [iso(3), iso(9)]);
    await product.update({ where: { id: rows.dropProduct }, data: { published: false, updatedAt: day(10) } });
    deepStrictEqual(await pages(), [iso(3), iso(10)]);
    // Hiding the latest news item changes the landing.
    await fixtures.createNews({ updatedAt: day(12), published: false });
    strictEqual((await sitemap()).landingLastModified, iso(12));
  });

  it('needs the internal key like every API route', async () => {
    const response = await app.api.withoutInternalKey().get<ApiErrorResponse>(SITEMAP_ROUTE);
    strictEqual(response.status, 401);
  });
});
