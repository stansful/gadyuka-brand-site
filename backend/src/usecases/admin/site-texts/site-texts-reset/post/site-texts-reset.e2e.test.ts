import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { setTimeout } from 'node:timers/promises';

import type { SiteMessagesResponse } from '~shared/contracts/content';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { SiteTextResetResponse } from '~shared/contracts/site-texts';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { MessageCatalog, MessagesDirectory } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { SiteTextsStore } from '~usecases/admin/site-texts/common/site-texts.store';
import { SiteTextFixtures } from '~usecases/admin/site-texts/common/test/site-text-fixtures';
import { SITE_MESSAGES_ROUTE } from '~usecases/public/content/site-messages/get/site-messages.route';

import { SITE_TEXTS_RESET_ROUTE } from './site-texts-reset.route';

describe('[e2e] POST /api/v1/admin/site-texts/reset', () => {
  /** The key only this file writes. */
  const SFX = 'about.sfx';
  const EDITED_AT = new Date('2026-10-20T10:00:00.000Z');
  const catalog = new MessageCatalog(MessagesDirectory.locate());
  const defaults = LocaleMap.build(locale => catalog.siteDefault(SFX, locale));
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: SiteTextFixtures;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = await SiteTextFixtures.capture(app.database, { keys: [SFX], imageKeys: [] });
  });

  after(async () => {
    await fixtures.restore();
    await admin.remove();
    await app.stop();
  });

  function reset<T = SiteTextResetResponse>(body: unknown) {
    return app.api.post<T>(SITE_TEXTS_RESET_ROUTE, { body, accessToken });
  }

  async function publicSfx(): Promise<unknown> {
    const response = await app.api.get<SiteMessagesResponse>(SITE_MESSAGES_ROUTE.replace(':locale', 'ru'));
    const about = response.body.messages.about;
    return typeof about === 'object' ? about.sfx : undefined;
  }

  it('stores the default of every locale with editedAt = null and refreshes the site messages', async () => {
    await fixtures.store({ key: SFX, locale: Locale.RU, value: 'Правка', editedAt: EDITED_AT });
    await fixtures.store({ key: SFX, locale: Locale.EN, value: '', editedAt: EDITED_AT });
    app.get(SiteMessagesService).invalidate();
    strictEqual(await publicSfx(), 'Правка');
    const response = await reset({ key: SFX });
    strictEqual(response.status, 200);
    deepStrictEqual(response.body, { key: SFX, values: defaults });
    for (const locale of LocaleMap.LOCALES) {
      deepStrictEqual(await fixtures.find(SFX, locale), { key: SFX, locale, value: defaults[locale], editedAt: null });
    }
    strictEqual(await publicSfx(), defaults.ru);
  });

  it('writes under the «Тексты сайта» lock, like a save', async () => {
    await fixtures.store({ key: SFX, locale: Locale.RU, value: 'Правка', editedAt: EDITED_AT });
    const [locked, released] = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
    const holder = app.database.client.$transaction(async transaction => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${SiteTextsStore.LOCK_NAMESPACE}::int4, ${SiteTextsStore.LOCK_KEY}::int4)`;
      locked.resolve();
      await released.promise;
    });
    await locked.promise;
    const pending = reset({ key: SFX });
    const early = await Promise.race([pending.then(() => 'reset'), setTimeout(300, 'waiting')]);
    released.resolve();
    await holder;
    deepStrictEqual(
      [early, (await pending).status, (await fixtures.find(SFX, Locale.RU))?.value],
      ['waiting', 200, defaults.ru],
    );
  });

  it('answers 404 for a key that is no site text (removed by a release, a branch, an admin key)', async () => {
    for (const key of ['zzz.removed', 'forms.errors', 'admin.siteTexts.title']) {
      const response = await reset<ApiErrorResponse>({ key });
      strictEqual(response.status, 404, key);
      deepStrictEqual(response.body, { statusCode: 404, error: 'notFound', key: 'admin.siteTexts.errors.unknownKey' });
    }
  });

  it('refuses a request without a text key', async () => {
    for (const body of [{}, { key: 1 }, { key: 'x'.repeat(201) }]) {
      const response = await reset<ApiValidationErrorResponse>(body);
      strictEqual(response.status, 400, JSON.stringify(body));
      deepStrictEqual(response.body.fields, { key: { key: 'admin.siteTexts.errors.unknownKey' } });
    }
  });
});
