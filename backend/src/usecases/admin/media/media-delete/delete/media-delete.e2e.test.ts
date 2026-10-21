import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import sharp from 'sharp';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { MediaItem } from '~shared/contracts/media';

import { MEDIA_MIME } from '~core/media/media.constants';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { MediaFixtures } from '~usecases/admin/media/common/test/media-fixtures';
import { MultipartClient } from '~usecases/admin/media/common/test/multipart-client';
import { MEDIA_UPLOAD_ROUTE } from '~usecases/admin/media/media-upload/post/media-upload.route';

import { MEDIA_DELETE_ROUTE } from './media-delete.route';

describe('[e2e] DELETE /api/v1/admin/media/:id', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: MediaFixtures;
  const leftKeys: string[] = [];

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = MediaFixtures.start(app.database, admin.id);
  });

  after(async () => {
    await app.mediaDisk.delete(leftKeys);
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function remove<T = string>(id: string) {
    return app.api.delete<T>(MEDIA_DELETE_ROUTE.replace(':id', id), { accessToken });
  }

  async function uploadImage(): Promise<{ id: string; key: string }> {
    const png = await sharp({ create: { width: 6, height: 4, channels: 3, background: '#123' } })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(png)]), 'delete-me.png');
    const uploaded = await MultipartClient.of(app).post<MediaItem>(MEDIA_UPLOAD_ROUTE, { body: form }, accessToken);
    fixtures.track(uploaded.body.id);
    const row = await app.database.client.media.findUniqueOrThrow({ where: { id: uploaded.body.id } });
    leftKeys.push(row.key);
    return { id: row.id, key: row.key };
  }

  it('deletes an unused file: the row (204), then its stored file', async () => {
    const media = await uploadImage();
    strictEqual(await app.mediaDisk.exists(media.key), true);
    strictEqual((await remove(media.id)).status, 204);
    strictEqual(await app.database.client.media.count({ where: { id: media.id } }), 0);
    strictEqual(await app.mediaDisk.exists(media.key), false);
  });

  it('refuses a file that is used somewhere with 409 inUse and the number of places, keeping it', async () => {
    const id = await fixtures.createMedia();
    await fixtures.createUsages(id);
    const response = await remove<ApiErrorResponse>(id);
    deepStrictEqual(
      [response.status, response.body.error, response.body.key, response.body.details],
      [409, 'conflict', 'admin.media.errors.inUse', { usageCount: 8 }],
    );
    strictEqual(await app.database.client.media.count({ where: { id } }), 1);
  });

  it('leaves a file alone whose row points into another bucket', async () => {
    const media = await fixtures.createMediaWithKey({ bucket: 'another-bucket' });
    await app.mediaDisk.put(media.key, Buffer.from('not ours'), { contentType: MEDIA_MIME });
    leftKeys.push(media.key);
    strictEqual((await remove(media.id)).status, 204);
    strictEqual(await app.mediaDisk.exists(media.key), true);
  });

  it('answers 404 notFoundDeleted for a missing file and 400 idInvalid for a malformed id', async () => {
    const missing = await remove<ApiErrorResponse>(randomUUID());
    deepStrictEqual([missing.status, missing.body.key], [404, 'admin.media.errors.notFoundDeleted']);
    const malformed = await remove<ApiValidationErrorResponse>('42');
    deepStrictEqual([malformed.status, malformed.body.fields], [400, { id: { key: 'admin.validation.idInvalid' } }]);
  });
});
