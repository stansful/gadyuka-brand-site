import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminNewsDetails } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { NEWS_DETAILS_ROUTE } from './news-details.route';

describe('[e2e] GET /api/v1/admin/news/:id', () => {
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

  function read<T = AdminNewsDetails>(id: string) {
    return app.api.get<T>(NEWS_DETAILS_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers the edit form: texts, the Moscow day of the date, the picture', async () => {
    const image = await rows.createMedia({ ru: 'Описание' });
    const slug = `e2e-news-${randomBytes(4).toString('hex')}`;
    const { id } = await app.database.client.newsItem.create({
      data: {
        slug,
        title: { ru: 'Поп-ап', de: 'ignored' },
        body: { en: 'Text' },
        date: new Date('2026-10-31T21:30:00.000Z'),
        imageId: image.id,
        published: true,
      },
      select: { id: true },
    });
    rows.track('newsItem', id);
    const response = await read(id);
    strictEqual(response.status, 200);
    deepStrictEqual(response.body, {
      id,
      slug,
      title: { ru: 'Поп-ап' },
      excerpt: {},
      body: { en: 'Text' },
      date: '2026-11-01',
      image,
      published: true,
    });
  });

  it('answers 404 for a news item that does not exist and 400 invalidId for a malformed id', async () => {
    deepStrictEqual((await read<ApiErrorResponse>(randomUUID())).body.key, 'admin.errors.notFound');
    const malformed = await read<ApiErrorResponse>('seed-news-1');
    deepStrictEqual([malformed.status, malformed.body.key], [400, 'admin.errors.invalidId']);
  });
});
