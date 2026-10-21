import { deepStrictEqual } from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { NEWS_UPDATE_ROUTE } from './news-update.route';

describe('[e2e] PUT /api/v1/admin/news/:id', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let rows: ContentTestRows;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    rows = new ContentTestRows(app.database, admin.id);
  });

  after(async () => {
    await rows.remove();
    await admin.remove();
    await app.stop();
  });

  function uniqueSlug(): string {
    return `e2e-news-${randomBytes(4).toString('hex')}`;
  }

  async function createNews(slug: string): Promise<string> {
    const row = await app.database.client.newsItem.create({
      data: { slug, title: { ru: 'Было' }, date: new Date('2026-01-01T09:00:00.000Z') },
      select: { id: true },
    });
    return rows.track('newsItem', row.id);
  }

  function newsForm(slug: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      slug,
      title: { ru: 'Стало' },
      excerpt: { en: 'Teaser' },
      body: {},
      date: '2026-10-31',
      imageId: null,
      published: true,
      ...overrides,
    };
  }

  function save<T = ContentEntitySaved>(id: string, body: unknown) {
    return app.api.put<T>(NEWS_UPDATE_ROUTE.replace(':id', id), { body, accessToken });
  }

  it('saves the form (its own slug stays allowed)', async () => {
    const slug = uniqueSlug();
    const id = await createNews(slug);
    const image = await rows.createMedia();
    const response = await save(id, newsForm(slug, { imageId: image.id }));
    deepStrictEqual([response.status, response.body], [200, { id }]);
    const stored = await app.database.client.newsItem.findUniqueOrThrow({ where: { id } });
    deepStrictEqual(
      [stored.title, stored.excerpt, stored.date.toISOString(), stored.imageId, stored.published],
      [{ ru: 'Стало' }, { en: 'Teaser' }, '2026-10-31T09:00:00.000Z', image.id, true],
    );
  });

  it('answers 409 slugTaken for the slug of another news item', async () => {
    const taken = uniqueSlug();
    await createNews(taken);
    const id = await createNews(uniqueSlug());
    const response = await save<ApiErrorResponse>(id, newsForm(taken));
    deepStrictEqual([response.status, response.body.key], [409, 'admin.errors.slugTaken']);
  });

  it('answers 400 missingMedia for a picture that no longer exists', async () => {
    const id = await createNews(uniqueSlug());
    const response = await save<ApiErrorResponse>(id, newsForm(uniqueSlug(), { imageId: randomUUID() }));
    deepStrictEqual([response.status, response.body.key], [400, 'admin.errors.missingMedia']);
  });

  it('answers 404 for a news item that does not exist, 400 invalidId for a malformed id', async () => {
    const missing = await save<ApiErrorResponse>(randomUUID(), newsForm(uniqueSlug()));
    deepStrictEqual(
      [missing.status, missing.body],
      [404, { statusCode: 404, error: 'notFound', key: 'admin.errors.notFound' }],
    );
    const malformed = await save<ApiErrorResponse>('seed-news-1', newsForm(uniqueSlug()));
    deepStrictEqual(
      [malformed.status, malformed.body],
      [400, { statusCode: 400, error: 'badRequest', key: 'admin.errors.invalidId' }],
    );
  });

  it('checks the id before the form', async () => {
    const response = await save<ApiErrorResponse>('nope', { slug: '' });
    deepStrictEqual([response.status, response.body.key], [400, 'admin.errors.invalidId']);
  });
});
