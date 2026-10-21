import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminGalleryItemDetails } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { GALLERY_DETAILS_ROUTE } from './gallery-details.route';

describe('[e2e] GET /api/v1/admin/gallery/:id', () => {
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

  function read<T = AdminGalleryItemDetails>(id: string) {
    return app.api.get<T>(GALLERY_DETAILS_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers the edit form of a gallery item', async () => {
    const media = await rows.createMedia({ en: 'Photo' });
    const { id } = await app.database.client.galleryItem.create({
      data: { mediaId: media.id, caption: { en: 'Caption' } },
      select: { id: true },
    });
    rows.track('galleryItem', id);
    const response = await read(id);
    deepStrictEqual(
      [response.status, response.body],
      [200, { id, media, caption: { en: 'Caption' }, published: false }],
    );
  });

  it('answers 404 notFound and 400 invalidId', async () => {
    deepStrictEqual((await read<ApiErrorResponse>(randomUUID())).body.key, 'admin.errors.notFound');
    deepStrictEqual((await read<ApiErrorResponse>('x')).body.key, 'admin.errors.invalidId');
  });
});
