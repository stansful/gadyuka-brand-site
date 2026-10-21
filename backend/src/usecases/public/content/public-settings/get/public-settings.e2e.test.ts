import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { PublicSettings, PublicSettingsResponse } from '~shared/contracts/content';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { SITE_SETTINGS_ID } from '~core/constants/site-settings.constants';
import { TestApp } from '~test/e2e/test-app';

import { PUBLIC_SETTINGS_ROUTE } from './public-settings.route';

/**
 * Read-only on purpose: the settings row is a singleton other e2e files (the admin settings) write,
 * so this file compares the answer with the row as it is (localization rules: unit tests of
 * PublicSettingsPresenter / LocalizedText).
 */
describe('[e2e] GET /api/v1/public/settings/:locale', () => {
  let app: TestApp;

  before(async () => {
    app = await TestApp.start();
  });

  after(async () => {
    await app.stop();
  });

  function settingsOf(locale: string) {
    return app.api.get<PublicSettingsResponse>(PUBLIC_SETTINGS_ROUTE.replace(':locale', locale));
  }

  const DEFAULTS: PublicSettings = {
    phone: '',
    email: '',
    address: '',
    reviewRatingMax: 5,
    seoTitle: '',
    seoDescription: '',
    ogImage: null,
  };

  /** The stored row as the English site shows it (ogImage aside), or the defaults without a row. */
  async function expectedEnglishSettings(): Promise<PublicSettings> {
    const row = await app.database.client.siteSettings.findUnique({
      where: { id: SITE_SETTINGS_ID },
      select: { phone: true, email: true, address: true, reviewRatingMax: true, seoTitle: true, seoDescription: true },
    });
    if (row === null) {
      return DEFAULTS;
    }
    const { address, seoTitle, seoDescription } = row;
    const texts = { address: english(address), seoTitle: english(seoTitle), seoDescription: english(seoDescription) };
    return { ...row, ...texts, ogImage: null };
  }

  /** A stored LocalizedText on the English site: en, else ru (trimmed), else "". */
  function english(value: unknown): string {
    const text: Record<string, unknown> = typeof value === 'object' && value !== null ? { ...value } : {};
    const translation = (locale: string): string => (typeof text[locale] === 'string' ? text[locale].trim() : '');
    return translation('en') || translation('ru');
  }

  it('answers the stored settings localized for the locale (the defaults before the first save)', async () => {
    const [expected, response] = await Promise.all([expectedEnglishSettings(), settingsOf('en')]);
    strictEqual(response.status, 200);
    strictEqual(response.body.locale, 'en');
    const { ogImage, ...settings } = response.body.settings;
    deepStrictEqual({ ...settings, ogImage: null }, expected);
    strictEqual(ogImage === null || typeof ogImage.src === 'string', true);
  });

  it('refuses an unknown locale with a validation key', async () => {
    const response = await app.api.get<ApiValidationErrorResponse>(PUBLIC_SETTINGS_ROUTE.replace(':locale', 'EN'));
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, { locale: { key: 'admin.validation.invalid' } });
  });

  it('needs the internal key like every API route', async () => {
    const response = await app.api
      .withoutInternalKey()
      .get<ApiErrorResponse>(PUBLIC_SETTINGS_ROUTE.replace(':locale', 'ru'));
    strictEqual(response.status, 401);
  });
});
