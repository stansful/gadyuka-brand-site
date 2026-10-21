import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type {
  AdminCatalogRowSaved,
  AdminReviewListResponse,
  AdminReviewRatingScaleResponse,
  AdminSiteSettingsResponse,
  AdminSiteSettingsSaveRequest,
} from '~shared/contracts/catalog';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { SITE_SETTINGS_ID } from '~core/constants/site-settings.constants';
import { Prisma } from '~prisma-generated/prisma/client';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';
import { REVIEW_CREATE_ROUTE } from '~usecases/admin/catalog/review-create/post/review-create.route';
import { REVIEW_LIST_ROUTE } from '~usecases/admin/catalog/review-list/get/review-list.route';
import { REVIEW_SCALE_ROUTE } from '~usecases/admin/catalog/review-scale/get/review-scale.route';
import { REVIEW_UPDATE_ROUTE } from '~usecases/admin/catalog/review-update/put/review-update.route';
import { SETTINGS_DETAILS_ROUTE } from '~usecases/admin/catalog/settings-details/get/settings-details.route';

import { SETTINGS_UPDATE_ROUTE } from './settings-update.route';

/**
 * The settings and everything that depends on the review star scale (reviews above the scale, the
 * scale check of review saves) in ONE file: e2e files run in parallel, and the scale is global.
 * The settings row of the test database is restored afterwards.
 */
describe('[e2e] PUT /api/v1/admin/settings (and the review star scale)', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: CatalogFixtures;
  let original: Prisma.SiteSettingsUncheckedCreateInput | null;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = new CatalogFixtures(app.database, admin.id);
    original = await storedSettings();
  });

  after(async () => {
    await restoreSettings();
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  /** The settings row of the test database as it was before this file (null = none). */
  async function storedSettings(): Promise<Prisma.SiteSettingsUncheckedCreateInput | null> {
    const row = await app.database.client.siteSettings.findUnique({ where: { id: SITE_SETTINGS_ID } });
    if (row === null) return null;
    const { address, seoTitle, seoDescription } = row;
    return { ...row, address: address ?? {}, seoTitle: seoTitle ?? {}, seoDescription: seoDescription ?? {} };
  }

  async function restoreSettings(): Promise<void> {
    const { client } = app.database;
    await client.siteSettings.deleteMany({ where: { id: SITE_SETTINGS_ID } });
    if (original !== null) await client.siteSettings.create({ data: original });
  }

  function input(overrides: Partial<AdminSiteSettingsSaveRequest> = {}): AdminSiteSettingsSaveRequest {
    return {
      phone: '+7 900 000-00-00',
      email: 'hello@example.ru',
      address: { ru: 'Краснодар' },
      reviewRatingMax: 10,
      seoTitle: {},
      seoDescription: {},
      ogImageId: null,
      ...overrides,
    };
  }

  function save<T = string>(body: unknown) {
    return app.api.put<T>(SETTINGS_UPDATE_ROUTE, { body, accessToken });
  }

  function readSettings() {
    return app.api.get<AdminSiteSettingsResponse>(SETTINGS_DETAILS_ROUTE, { accessToken });
  }

  it('answers the defaults before the first save, then stores the settings (204)', async () => {
    await app.database.client.siteSettings.deleteMany({ where: { id: SITE_SETTINGS_ID } });
    const defaults = { phone: '', email: '', address: {}, reviewRatingMax: 5, seoTitle: {}, seoDescription: {} };
    deepStrictEqual((await readSettings()).body, { ...defaults, ogImage: null });
    const og = await fixtures.createMedia({ ru: 'Обложка' });
    const response = await save(
      input({ phone: ' +7 900 ', address: { ru: ' Краснодар ', en: '' }, seoTitle: { en: 'GADYUKA' }, ogImageId: og }),
    );
    strictEqual(response.status, 204);
    const { ogImage, ...stored } = (await readSettings()).body;
    deepStrictEqual(stored, {
      phone: '+7 900',
      email: 'hello@example.ru',
      address: { ru: 'Краснодар' },
      reviewRatingMax: 10,
      seoTitle: { en: 'GADYUKA' },
      seoDescription: {},
    });
    deepStrictEqual([ogImage?.id, ogImage?.alt], [og, { ru: 'Обложка' }]);
  });

  it('refuses a deleted OG image (400 missingMedia) before checking the scale', async () => {
    await fixtures.createReview(3);
    const response = await save<ApiErrorResponse>(input({ ogImageId: randomUUID(), reviewRatingMax: 2 }));
    deepStrictEqual(response.body, { statusCode: 400, error: 'badRequest', key: 'admin.errors.missingMedia' });
  });

  it('cannot lower the scale below stored ratings: 409 with their count, listed by ?ratingAbove', async () => {
    strictEqual((await save(input({ reviewRatingMax: 10 }))).status, 204);
    const high = [await fixtures.createReview(9), await fixtures.createReview(10)];
    const count = await app.database.client.review.count({ where: { rating: { gt: 8 } } });
    const response = await save<ApiErrorResponse>(input({ reviewRatingMax: 8 }));
    strictEqual(response.status, 409);
    deepStrictEqual(response.body, {
      statusCode: 409,
      error: 'conflict',
      key: 'admin.settings.scaleTooLow',
      values: { count, max: 8 },
    });
    ok(count >= 2);
    const listed = await app.api.get<AdminReviewListResponse>(`${REVIEW_LIST_ROUTE}?ratingAbove=8`, { accessToken });
    deepStrictEqual(
      listed.body.items
        .filter(item => item.author.startsWith(fixtures.tag))
        .map(item => item.id)
        .sort(),
      [...high].sort(),
    );
    strictEqual((await readSettings()).body.reviewRatingMax, 10);
  });

  it('checks the rating of a review save against the current scale', async () => {
    await app.database.client.review.deleteMany({ where: { author: { startsWith: fixtures.tag } } });
    strictEqual((await save(input({ reviewRatingMax: 5 }))).status, 204);
    deepStrictEqual((await app.api.get<AdminReviewRatingScaleResponse>(REVIEW_SCALE_ROUTE, { accessToken })).body, {
      max: 5,
    });
    const review = {
      author: fixtures.author('Анна'),
      role: {},
      text: { ru: 'Отлично' },
      avatarId: null,
      published: true,
    };
    const above = await app.api.post<ApiErrorResponse>(REVIEW_CREATE_ROUTE, {
      body: { ...review, rating: 6 },
      accessToken,
    });
    deepStrictEqual(above.body, {
      statusCode: 400,
      error: 'badRequest',
      key: 'admin.reviews.ratingAboveScale',
      values: { rating: 6, max: 5 },
    });
    const created = await app.api.post<AdminCatalogRowSaved>(REVIEW_CREATE_ROUTE, {
      body: { ...review, rating: 5 },
      accessToken,
    });
    strictEqual(created.status, 201);
    const path = REVIEW_UPDATE_ROUTE.replace(':id', created.body.id);
    const raised = await app.api.put<ApiErrorResponse>(path, { body: { ...review, rating: 7 }, accessToken });
    deepStrictEqual(
      [raised.status, raised.body.key, raised.body.values],
      [400, 'admin.reviews.ratingAboveScale', { rating: 7, max: 5 }],
    );
    const list = await app.api.get<AdminReviewListResponse>(REVIEW_LIST_ROUTE, { accessToken });
    strictEqual(list.body.ratingMax, 5);
  });

  it('refuses an invalid form with field keys', async () => {
    const response = await save<ApiValidationErrorResponse>(
      input({
        phone: 'call me',
        email: 'nope',
        reviewRatingMax: 11,
        seoDescription: { en: 'x'.repeat(401) },
        ogImageId: 'og',
      }),
    );
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      phone: { key: 'admin.validation.phoneFormat' },
      email: { key: 'admin.validation.email' },
      reviewRatingMax: { key: 'admin.validation.starsRange', values: { min: 1, max: 10 } },
      'seoDescription.en': { key: 'admin.validation.tooLong', values: { max: 400 } },
      ogImageId: { key: 'admin.validation.idInvalid' },
    });
  });
});
