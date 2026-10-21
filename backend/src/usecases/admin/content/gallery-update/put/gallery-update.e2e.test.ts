import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { GALLERY_UPDATE_ROUTE } from './gallery-update.route';

describe('[e2e] PUT /api/v1/admin/gallery/:id', () => {
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

  async function createItem(): Promise<string> {
    const media = await rows.createMedia();
    const row = await app.database.client.galleryItem.create({
      data: { mediaId: media.id, order: 7 },
      select: { id: true },
    });
    return rows.track('galleryItem', row.id);
  }

  function save<T = ContentEntitySaved>(id: string, body: unknown) {
    return app.api.put<T>(GALLERY_UPDATE_ROUTE.replace(':id', id), { body, accessToken });
  }

  it('saves the photo, caption and flag; the place in the gallery stays', async () => {
    const id = await createItem();
    const media = await rows.createMedia();
    const response = await save(id, { mediaId: media.id, caption: { en: 'Caption' }, published: true });
    deepStrictEqual([response.status, response.body], [200, { id }]);
    const stored = await app.database.client.galleryItem.findUniqueOrThrow({ where: { id } });
    deepStrictEqual(
      [stored.mediaId, stored.caption, stored.published, stored.order],
      [media.id, { en: 'Caption' }, true, 7],
    );
  });

  it('answers missingMedia, notFound and invalidId', async () => {
    const id = await createItem();
    const missingMedia = await save<ApiErrorResponse>(id, { mediaId: randomUUID(), caption: {}, published: true });
    deepStrictEqual([missingMedia.status, missingMedia.body.key], [400, 'admin.errors.missingMedia']);
    const media = await rows.createMedia();
    const missingRow = await save<ApiErrorResponse>(randomUUID(), { mediaId: media.id, caption: {}, published: true });
    deepStrictEqual([missingRow.status, missingRow.body.key], [404, 'admin.errors.notFound']);
    const malformed = await save<ApiErrorResponse>('x', { mediaId: media.id, caption: {}, published: true });
    deepStrictEqual([malformed.status, malformed.body.key], [400, 'admin.errors.invalidId']);
  });
});
