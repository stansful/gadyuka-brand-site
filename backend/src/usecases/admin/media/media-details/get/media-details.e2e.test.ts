import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { MediaDetailsResponse } from '~shared/contracts/media';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { MediaFixtures } from '~usecases/admin/media/common/test/media-fixtures';

import { MEDIA_DETAILS_ROUTE } from './media-details.route';

describe('[e2e] GET /api/v1/admin/media/:id', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: MediaFixtures;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = MediaFixtures.start(app.database, admin.id);
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function details<T = MediaDetailsResponse>(id: string) {
    return app.api.get<T>(MEDIA_DETAILS_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers an unused file with its metadata and no usages', async () => {
    const id = await fixtures.createMedia({ alt: { ru: 'Худи', en: 'Hoodie' } });
    const response = await details(id);
    strictEqual(response.status, 200);
    deepStrictEqual(
      [response.body.media.id, response.body.media.alt, response.body.media.usageCount],
      [id, { ru: 'Худи', en: 'Hoodie' }, 0],
    );
    deepStrictEqual(response.body.usages, []);
  });

  it('lists every place that uses the file, in kind order, with admin links and stored titles', async () => {
    const id = await fixtures.createMedia();
    const used = await fixtures.createUsages(id);
    const response = await details(id);
    strictEqual(response.body.media.usageCount, 8);
    deepStrictEqual(response.body.usages, [
      { kind: 'landingImage', href: `/admin/content?section=${fixtures.tag}`, title: '', contentKey: used.contentKey },
      {
        kind: 'collectionCover',
        href: `/admin/collections/${used.collectionId}`,
        title: `Коллекция ${fixtures.tag}`,
        contentKey: null,
      },
      { kind: 'productPhoto', href: `/admin/products/${used.productId}`, title: 'Худи', contentKey: null },
      { kind: 'reviewAvatar', href: `/admin/reviews/${used.reviewId}`, title: 'Анна', contentKey: null },
      { kind: 'news', href: `/admin/news/${used.newsId}`, title: 'Новость', contentKey: null },
      { kind: 'gallery', href: `/admin/gallery/${used.galleryItemId}`, title: '', contentKey: null },
      { kind: 'offer', href: `/admin/offers/${used.offerId}`, title: '', contentKey: null },
      { kind: 'partnerLogo', href: `/admin/partners/${used.partnerId}`, title: 'Ателье', contentKey: null },
    ]);
  });

  it('answers 404 notFound for a missing file and 400 idInvalid for a malformed id', async () => {
    const missing = await details<ApiErrorResponse>(randomUUID());
    deepStrictEqual([missing.status, missing.body.key], [404, 'admin.media.errors.notFound']);
    const malformed = await details<ApiValidationErrorResponse>('42');
    deepStrictEqual([malformed.status, malformed.body.fields], [400, { id: { key: 'admin.validation.idInvalid' } }]);
  });
});
