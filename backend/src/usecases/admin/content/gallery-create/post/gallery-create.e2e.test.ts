import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { GALLERY_CREATE_ROUTE } from './gallery-create.route';

describe('[e2e] POST /api/v1/admin/gallery', () => {
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

  async function create<T = ContentEntitySaved>(body: unknown) {
    const response = await app.api.post<T>(GALLERY_CREATE_ROUTE, { body, accessToken });
    if (response.status === 201) {
      rows.track('galleryItem', (response.body as ContentEntitySaved).id);
    }
    return response;
  }

  it('adds the photo to the end of the gallery with its caption normalized', async () => {
    const existing = await rows.createMedia();
    const last = await app.database.client.galleryItem.create({
      data: { mediaId: existing.id, order: 5000 },
      select: { id: true },
    });
    rows.track('galleryItem', last.id);
    const media = await rows.createMedia();
    const response = await create({ mediaId: media.id, caption: { ru: ' Подпись ', en: '' }, published: true });
    strictEqual(response.status, 201);
    const stored = await app.database.client.galleryItem.findUniqueOrThrow({ where: { id: response.body.id } });
    deepStrictEqual([stored.mediaId, stored.caption, stored.published], [media.id, { ru: 'Подпись' }, true]);
    ok(stored.order > 5000, `order ${stored.order} after the last item`);
  });

  it('refuses a form without a photo, and a photo that no longer exists', async () => {
    const invalid = await create<ApiValidationErrorResponse>({ mediaId: '', caption: {}, published: true });
    deepStrictEqual([invalid.status, invalid.body.fields], [400, { mediaId: { key: 'admin.validation.idRequired' } }]);
    const missing = await create<ApiErrorResponse>({ mediaId: randomUUID(), caption: {}, published: true });
    deepStrictEqual([missing.status, missing.body.key], [400, 'admin.errors.missingMedia']);
  });

  it('needs a signed-in admin', async () => {
    strictEqual((await app.api.post(GALLERY_CREATE_ROUTE, { body: {} })).status, 401);
  });
});
