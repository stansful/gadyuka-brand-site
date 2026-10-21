import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { NEWS_CREATE_ROUTE } from './news-create.route';

describe('[e2e] POST /api/v1/admin/news', () => {
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

  function newsForm(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const slug = `e2e-news-${randomBytes(4).toString('hex')}`;
    const texts = { title: { ru: 'Поп-ап' }, excerpt: {}, body: {} };
    return { slug, ...texts, date: '2026-10-01', imageId: null, published: false, ...overrides };
  }

  async function create<T = ContentEntitySaved>(body: unknown) {
    const response = await app.api.post<T>(NEWS_CREATE_ROUTE, { body, accessToken });
    if (response.status === 201) {
      rows.track('newsItem', (response.body as ContentEntitySaved).id);
    }
    return response;
  }

  it('creates a news item: normalized texts and slug, the day stored as noon Moscow time', async () => {
    const image = await rows.createMedia();
    const form = newsForm({
      title: { ru: ' Поп-ап ', en: '' },
      body: { ru: 'Текст', en: ' Text ' },
      imageId: image.id,
    });
    const response = await create({ ...form, slug: ` ${String(form.slug).toUpperCase()} ` });
    strictEqual(response.status, 201);
    const stored = await app.database.client.newsItem.findUniqueOrThrow({ where: { id: response.body.id } });
    deepStrictEqual(
      [
        stored.slug,
        stored.title,
        stored.excerpt,
        stored.body,
        stored.date.toISOString(),
        stored.imageId,
        stored.published,
      ],
      [form.slug, { ru: 'Поп-ап' }, {}, { ru: 'Текст', en: 'Text' }, '2026-10-01T09:00:00.000Z', image.id, false],
    );
  });

  it('refuses an invalid form with the field keys', async () => {
    const response = await create<ApiValidationErrorResponse>(
      newsForm({ slug: 'два слова', title: { en: 'Pop-up' }, date: '2026-02-30', imageId: 'nope', extra: 1 }),
    );
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      slug: { key: 'admin.validation.slugFormat' },
      'title.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
      date: { key: 'admin.validation.dateRequired' },
      imageId: { key: 'admin.validation.idInvalid' },
      extra: { key: 'admin.validation.unknownField' },
    });
  });

  it('answers 409 slugTaken when another news item has the slug', async () => {
    const form = newsForm();
    strictEqual((await create(form)).status, 201);
    const response = await create<ApiErrorResponse>({ ...newsForm(), slug: form.slug });
    deepStrictEqual(
      [response.status, response.body],
      [409, { statusCode: 409, error: 'conflict', key: 'admin.errors.slugTaken' }],
    );
  });

  it('answers 400 missingMedia for a picture that no longer exists', async () => {
    const response = await create<ApiErrorResponse>(newsForm({ imageId: randomUUID() }));
    deepStrictEqual(
      [response.status, response.body],
      [400, { statusCode: 400, error: 'badRequest', key: 'admin.errors.missingMedia' }],
    );
  });

  it('needs a signed-in admin', async () => {
    const response = await app.api.post<ApiErrorResponse>(NEWS_CREATE_ROUTE, { body: newsForm() });
    strictEqual(response.status, 401);
  });
});
