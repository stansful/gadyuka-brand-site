import { deepStrictEqual } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminNewsListResponse } from '~shared/contracts/content-entities';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { NEWS_LIST_ROUTE } from './news-list.route';

describe('[e2e] GET /api/v1/admin/news', () => {
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

  async function createNews(name: string, date: string, createdAt: string): Promise<string> {
    const slug = `e2e-${name}-${randomBytes(4).toString('hex')}`;
    const row = await app.database.client.newsItem.create({
      data: { slug, title: { ru: name }, date: new Date(date), createdAt: new Date(createdAt) },
      select: { id: true },
    });
    return rows.track('newsItem', row.id);
  }

  it('lists the news newest first: by date, then the later created', async () => {
    const old = await createNews('old', '2026-01-01T09:00:00.000Z', '2026-01-03T00:00:00.000Z');
    const first = await createNews('first', '2026-10-01T09:00:00.000Z', '2026-01-01T00:00:00.000Z');
    const second = await createNews('second', '2026-10-01T09:00:00.000Z', '2026-01-02T00:00:00.000Z');
    const response = await app.api.get<AdminNewsListResponse>(NEWS_LIST_ROUTE, { accessToken });
    const mine = response.body.items.filter(item => [old, first, second].includes(item.id));
    deepStrictEqual(
      mine.map(item => [item.id, item.date, item.title, item.image, item.published]),
      [
        [second, '2026-10-01', { ru: 'second' }, null, false],
        [first, '2026-10-01', { ru: 'first' }, null, false],
        [old, '2026-01-01', { ru: 'old' }, null, false],
      ],
    );
  });
});
