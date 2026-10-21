import { deepStrictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminGalleryListResponse } from '~shared/contracts/content-entities';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { GALLERY_LIST_ROUTE } from './gallery-list.route';

describe('[e2e] GET /api/v1/admin/gallery', () => {
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

  it('lists the photos in the manual order with their media and captions', async () => {
    const [first, second] = [await rows.createMedia({ ru: 'Фото' }), await rows.createMedia()];
    const created = await app.database.client.galleryItem.createManyAndReturn({
      data: [
        { mediaId: second.id, caption: {}, order: 2, published: false },
        { mediaId: first.id, caption: { ru: 'Подпись' }, order: 1, published: true },
      ],
      select: { id: true, mediaId: true },
    });
    const ids = created.map(row => rows.track('galleryItem', row.id));
    const response = await app.api.get<AdminGalleryListResponse>(GALLERY_LIST_ROUTE, { accessToken });
    const mine = response.body.items.filter(item => ids.includes(item.id));
    deepStrictEqual(
      mine.map(({ media, caption, published }) => ({ media, caption, published })),
      [
        { media: first, caption: { ru: 'Подпись' }, published: true },
        { media: second, caption: {}, published: false },
      ],
    );
  });
});
