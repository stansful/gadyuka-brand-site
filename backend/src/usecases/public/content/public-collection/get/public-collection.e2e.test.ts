import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { PublicCollectionResponse } from '~shared/contracts/content';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { PublicContentFixtures } from '~usecases/public/content/common/test/public-content-fixtures';

import { PUBLIC_COLLECTION_ROUTE } from './public-collection.route';

describe('[e2e] GET /api/v1/public/collections/:slug?locale=', () => {
  let app: TestApp;
  let owner: TestAdmin;
  let fixtures: PublicContentFixtures;
  let published: { id: string; slug: string; products: string[] };
  let hiddenSlug: string;

  before(async () => {
    app = await TestApp.start();
    owner = await TestAdmin.create(app.database);
    fixtures = new PublicContentFixtures(app.database, owner.id);
    published = await createPublished();
    hiddenSlug = fixtures.nextSlug();
    await fixtures.createCollection({ slug: hiddenSlug, published: false });
  });

  after(async () => {
    await fixtures.remove();
    await owner.remove();
    await app.stop();
  });

  async function createPublished(): Promise<{ id: string; slug: string; products: string[] }> {
    const slug = fixtures.nextSlug();
    const cover = await fixtures.createMedia({ alt: { ru: 'Обложка', en: 'Cover' } });
    const id = await fixtures.createCollection({ slug, published: true, title: { ru: 'Нуар' }, coverId: cover });
    const second = await fixtures.createProduct(id, { order: 1, published: true, description: { ru: 'Описание' } });
    const first = await fixtures.createProduct(id, { order: 0, published: true, title: { ru: 'Пальто', en: 'Coat' } });
    await fixtures.createProduct(id, { order: 0, published: false });
    return { id, slug, products: [first, second] };
  }

  function collectionOf(slug: string, query = '?locale=en') {
    return app.api.get<PublicCollectionResponse>(`${PUBLIC_COLLECTION_ROUTE.replace(':slug', slug)}${query}`);
  }

  it('answers a published collection with its published products, ordered and localized', async () => {
    const response = await collectionOf(published.slug);
    strictEqual(response.status, 200);
    const { locale, collection } = response.body;
    deepStrictEqual(
      [locale, collection.id, collection.slug, collection.title, collection.cover?.alt],
      ['en', published.id, published.slug, 'Нуар', 'Cover'],
    );
    deepStrictEqual(
      collection.products.map(product => [product.id, product.title, product.description]),
      [
        [published.products[0], 'Coat', ''],
        [published.products[1], fixtures.tag, 'Описание'],
      ],
    );
  });

  it('answers 404 for a hidden collection and for an unknown slug', async () => {
    for (const slug of [hiddenSlug, fixtures.nextSlug()]) {
      const response = await app.api.get<ApiErrorResponse>(
        `${PUBLIC_COLLECTION_ROUTE.replace(':slug', slug)}?locale=ru`,
      );
      strictEqual(response.status, 404, slug);
      deepStrictEqual([response.body.error, response.body.key], ['notFound', 'admin.errors.notFound']);
    }
  });

  it('refuses a slug that cannot exist and a missing or unknown locale with validation keys', async () => {
    const refusals: Array<[string, string, Record<string, { key: string }>]> = [
      ['Noir', '?locale=ru', { slug: { key: 'admin.validation.invalid' } }],
      ['-noir', '?locale=ru', { slug: { key: 'admin.validation.invalid' } }],
      [published.slug, '', { locale: { key: 'admin.validation.invalid' } }],
      [published.slug, '?locale=de', { locale: { key: 'admin.validation.invalid' } }],
    ];
    for (const [slug, query, fields] of refusals) {
      const response = await app.api.get<ApiValidationErrorResponse>(
        `${PUBLIC_COLLECTION_ROUTE.replace(':slug', slug)}${query}`,
      );
      strictEqual(response.status, 400, `${slug}${query}`);
      deepStrictEqual(response.body.fields, fields);
    }
  });

  it('refuses a slug longer than the admin allows', async () => {
    const response = await app.api.get<ApiValidationErrorResponse>(
      `${PUBLIC_COLLECTION_ROUTE.replace(':slug', 'a'.repeat(121))}?locale=ru`,
    );
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, { slug: { key: 'admin.validation.tooLong', values: { max: 120 } } });
  });

  it('needs the internal key like every API route', async () => {
    const response = await app.api
      .withoutInternalKey()
      .get<ApiErrorResponse>(`${PUBLIC_COLLECTION_ROUTE.replace(':slug', published.slug)}?locale=ru`);
    strictEqual(response.status, 401);
  });
});
