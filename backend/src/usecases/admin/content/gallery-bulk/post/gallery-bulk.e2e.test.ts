import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminGalleryBulkAdded } from '~shared/contracts/content-entities';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { GALLERY_BULK_ROUTE } from './gallery-bulk.route';

describe('[e2e] POST /api/v1/admin/gallery/bulk', () => {
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

  async function itemsOf(mediaIds: string[]) {
    const items = await app.database.client.galleryItem.findMany({
      where: { mediaId: { in: mediaIds } },
      orderBy: { order: 'asc' },
      select: { id: true, mediaId: true, order: true, caption: true, published: true },
    });
    items.forEach(item => rows.track('galleryItem', item.id));
    return items;
  }

  it('appends the photos in the given order, without captions, with the given flag', async () => {
    const media = [await rows.createMedia(), await rows.createMedia(), await rows.createMedia()];
    const mediaIds = media.map(file => file.id);
    const response = await app.api.post<AdminGalleryBulkAdded>(GALLERY_BULK_ROUTE, {
      body: { mediaIds, published: true },
      accessToken,
    });
    deepStrictEqual([response.status, response.body], [201, { count: 3 }]);
    const items = await itemsOf(mediaIds);
    deepStrictEqual(
      items.map(item => [item.mediaId, item.caption, item.published]),
      mediaIds.map(id => [id, {}, true]),
    );
    ok(items.every((item, index) => index === 0 || item.order === (items[index - 1]?.order ?? 0) + 1));
  });

  it('adds nothing when one of the photos no longer exists', async () => {
    const file = await rows.createMedia();
    const response = await app.api.post<ApiErrorResponse>(GALLERY_BULK_ROUTE, {
      body: { mediaIds: [file.id, randomUUID()], published: true },
      accessToken,
    });
    deepStrictEqual([response.status, response.body.key], [400, 'admin.errors.missingMedia']);
    strictEqual((await itemsOf([file.id])).length, 0);
  });

  it('refuses an empty list', async () => {
    const response = await app.api.post<ApiValidationErrorResponse>(GALLERY_BULK_ROUTE, {
      body: { mediaIds: [], published: true },
      accessToken,
    });
    deepStrictEqual(response.body.fields, { mediaIds: { key: 'admin.validation.photosRequired', values: { min: 1 } } });
  });
});
