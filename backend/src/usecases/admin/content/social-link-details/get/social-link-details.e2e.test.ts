import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminSocialLinkDetails } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { SOCIAL_LINK_DETAILS_ROUTE } from './social-link-details.route';

describe('[e2e] GET /api/v1/admin/social-links/:id', () => {
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

  function read<T = AdminSocialLinkDetails>(id: string) {
    return app.api.get<T>(SOCIAL_LINK_DETAILS_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers the edit form of a social link', async () => {
    const { id } = await app.database.client.socialLink.create({
      data: { type: 'WEBSITE', url: 'https://example.ru', label: { en: 'Shop' } },
      select: { id: true },
    });
    rows.track('socialLink', id);
    deepStrictEqual((await read(id)).body, {
      id,
      type: 'WEBSITE',
      url: 'https://example.ru',
      label: { en: 'Shop' },
      published: true,
    });
  });

  it('answers 404 notFound and 400 invalidId', async () => {
    deepStrictEqual((await read<ApiErrorResponse>(randomUUID())).body.key, 'admin.errors.notFound');
    deepStrictEqual((await read<ApiErrorResponse>('x')).body.key, 'admin.errors.invalidId');
  });
});
