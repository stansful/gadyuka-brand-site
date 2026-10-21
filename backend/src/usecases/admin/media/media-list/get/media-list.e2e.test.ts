import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { MediaListResponse } from '~shared/contracts/media';

import { MEDIA_PAGE_SIZE } from '~core/media/media-library.constants';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { MediaFixtures } from '~usecases/admin/media/common/test/media-fixtures';

import { MEDIA_LIST_ROUTE } from './media-list.route';

describe('[e2e] GET /api/v1/admin/media', () => {
  const START = Date.UTC(2026, 0, 1);
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: MediaFixtures;
  /** The test's rows, newest first */
  let ids: string[];

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = MediaFixtures.start(app.database, admin.id);
    const created = await Promise.all(
      Array.from({ length: MEDIA_PAGE_SIZE + 2 }, (_, index) =>
        fixtures.createMedia({ name: `Photo-${index}.JPG`, createdAt: new Date(START + index * 1000) }),
      ),
    );
    ids = created.reverse();
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function list(query: string) {
    return app.api.get<MediaListResponse>(`${MEDIA_LIST_ROUTE}?${query}`, { accessToken });
  }

  it('pages 60 files newest first: nextCursor = the last id, then the rest after it', async () => {
    const first = await list(`q=${fixtures.tag}`);
    strictEqual(first.status, 200);
    deepStrictEqual(
      first.body.items.map(item => item.id),
      ids.slice(0, MEDIA_PAGE_SIZE),
    );
    strictEqual(first.body.nextCursor, ids[MEDIA_PAGE_SIZE - 1]);
    ok(first.body.total >= ids.length);
    const second = await list(`q=${fixtures.tag}&cursor=${first.body.nextCursor}`);
    deepStrictEqual(
      second.body.items.map(item => item.id),
      ids.slice(MEDIA_PAGE_SIZE),
    );
    strictEqual(second.body.nextCursor, null);
  });

  it('searches the original names ignoring case (trimmed; a long text is cut, not refused)', async () => {
    const found = await list(`q=${encodeURIComponent(`  ${fixtures.tag.toUpperCase()}-photo-61.jpg `)}`);
    deepStrictEqual(
      found.body.items.map(item => item.id),
      [ids[0]],
    );
    const long = await list(`q=${fixtures.tag}-photo-61.jpg${'x'.repeat(200)}`);
    deepStrictEqual([long.status, long.body.items], [200, []]);
  });

  it('answers each file with its metadata, alt text and usage count', async () => {
    const [newest] = (await list(`q=${fixtures.tag}-photo-61`)).body.items;
    deepStrictEqual(newest, {
      id: ids[0],
      url: newest?.url,
      width: 10,
      height: 8,
      alt: {},
      mime: 'image/webp',
      size: 100,
      originalName: `${fixtures.tag}-Photo-61.JPG`,
      createdAt: new Date(START + 61_000).toISOString(),
      usageCount: 0,
    });
  });

  it('treats an empty cursor and search as none, an unknown cursor as the end', async () => {
    const empty = await list('cursor=&q=');
    strictEqual(empty.status, 200);
    strictEqual(empty.body.items.length > 0, true);
    deepStrictEqual((await list(`cursor=${randomUUID()}`)).body.items, []);
  });

  it('refuses a malformed cursor with admin.media.errors.badCursor', async () => {
    const response = await app.api.get<ApiValidationErrorResponse>(`${MEDIA_LIST_ROUTE}?cursor=../x`, { accessToken });
    deepStrictEqual(
      [response.status, response.body.fields],
      [400, { cursor: { key: 'admin.media.errors.badCursor' } }],
    );
  });
});
