import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { MediaAltResponse } from '~shared/contracts/media';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { MediaFixtures } from '~usecases/admin/media/common/test/media-fixtures';

import { MEDIA_ALT_ROUTE } from './media-alt.route';

describe('[e2e] PATCH /api/v1/admin/media/:id/alt', () => {
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

  function saveAlt<T = MediaAltResponse>(id: string, body: unknown) {
    return app.api.patch<T>(MEDIA_ALT_ROUTE.replace(':id', id), { body, accessToken });
  }

  async function storedAlt(id: string): Promise<unknown> {
    return (await app.database.client.media.findUniqueOrThrow({ where: { id }, select: { alt: true } })).alt;
  }

  it('stores the trimmed translations, dropping empty ones', async () => {
    const id = await fixtures.createMedia({ alt: { ru: 'Старое', en: 'Old' } });
    const response = await saveAlt(id, { alt: { ru: '  Белое худи ', en: '   ' } });
    deepStrictEqual([response.status, response.body], [200, { id, alt: { ru: 'Белое худи' } }]);
    deepStrictEqual(await storedAlt(id), { ru: 'Белое худи' });
    deepStrictEqual((await saveAlt(id, { alt: {} })).body.alt, {});
    deepStrictEqual(await storedAlt(id), {});
  });

  it('refuses a translation over 300 characters (spaces around it do not count), per locale', async () => {
    const id = await fixtures.createMedia();
    const fits = await saveAlt(id, { alt: { ru: `  ${'a'.repeat(300)}  ` } });
    strictEqual(fits.status, 200);
    const response = await saveAlt<ApiValidationErrorResponse>(id, { alt: { en: 'b'.repeat(301) } });
    deepStrictEqual(
      [response.status, response.body.fields],
      [400, { 'alt.en': { key: 'admin.validation.tooLong', values: { max: 300 } } }],
    );
    const huge = await saveAlt<ApiValidationErrorResponse>(id, { alt: { ru: `${' '.repeat(20_000)}x` } });
    deepStrictEqual(huge.body.fields['alt.ru'], { key: 'admin.validation.tooLong', values: { max: 20_000 } });
  });

  it('refuses malformed bodies with field keys', async () => {
    const id = await fixtures.createMedia();
    const cases: Array<[unknown, string, string]> = [
      [{}, 'alt', 'admin.validation.required'],
      [{ alt: 'text' }, 'alt', 'admin.validation.invalid'],
      [{ alt: { ru: 5 } }, 'alt.ru', 'admin.validation.invalid'],
      [{ alt: { de: 'x' } }, 'alt.de', 'admin.validation.unknownField'],
    ];
    for (const [body, path, key] of cases) {
      const response = await saveAlt<ApiValidationErrorResponse>(id, body);
      deepStrictEqual([response.status, response.body.fields[path]?.key], [400, key], JSON.stringify(body));
    }
  });

  it('answers 404 notFound for a missing file and 400 idInvalid for a malformed id', async () => {
    const missing = await saveAlt<ApiErrorResponse>(randomUUID(), { alt: { ru: 'x' } });
    deepStrictEqual([missing.status, missing.body.key], [404, 'admin.errors.notFound']);
    const malformed = await saveAlt<ApiValidationErrorResponse>('42', { alt: { ru: 'x' } });
    deepStrictEqual([malformed.status, malformed.body.fields.id], [400, { key: 'admin.validation.idInvalid' }]);
  });
});
