import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { setTimeout } from 'node:timers/promises';

import type { SiteMessagesResponse } from '~shared/contracts/content';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type {
  SiteImageChangeRequest,
  SiteTextChangeRequest,
  SiteTextsSaveResponse,
} from '~shared/contracts/site-texts';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { MessageCatalog, MessagesDirectory } from '~module/messages';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { SiteTextsStore } from '~usecases/admin/site-texts/common/site-texts.store';
import { SiteTextFixtures } from '~usecases/admin/site-texts/common/test/site-text-fixtures';
import { SITE_MESSAGES_ROUTE } from '~usecases/public/content/site-messages/get/site-messages.route';

import { SITE_TEXTS_SAVE_ROUTE } from './site-texts-save.route';

/**
 * PUT /admin/site-texts end to end (port of the frontend's saveSiteTexts tests): the optimistic
 * concurrency of «Тексты сайта» — payload → lock → conflict check → writes — and every refusal.
 */
describe('[e2e] PUT /api/v1/admin/site-texts', () => {
  /** Keys only this file writes. */
  const SFX = 'hero.sfx';
  const CURSOR = 'hero.cursor';
  const IMAGE = 'tailoring.image';
  const EDITED_AT = new Date('2026-10-20T10:00:00.000Z');
  const catalog = new MessageCatalog(MessagesDirectory.locate());
  const ru = (key: string): string => catalog.siteDefault(key, Locale.RU);
  const en = (key: string): string => catalog.siteDefault(key, Locale.EN);
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: SiteTextFixtures;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = await SiteTextFixtures.capture(app.database, { keys: [SFX, CURSOR], imageKeys: [IMAGE] });
  });

  beforeEach(async () => {
    await fixtures.clear();
    for (const key of [SFX, CURSOR]) {
      for (const locale of LocaleMap.LOCALES) {
        await fixtures.store({ key, locale, value: catalog.siteDefault(key, locale), editedAt: null });
      }
    }
  });

  after(async () => {
    await fixtures.restore();
    await admin.remove();
    await app.stop();
  });

  function save<T = SiteTextsSaveResponse>(entries: unknown, images: unknown = []) {
    return app.api.put<T>(SITE_TEXTS_SAVE_ROUTE, { body: { entries, images }, accessToken });
  }

  function text(key: string, locale: Locale, edit: { value: string; base: string }): SiteTextChangeRequest {
    return { key, values: { [locale]: edit } };
  }

  function image(mediaId: string | null, base: string | null): SiteImageChangeRequest {
    return { key: IMAGE, mediaId, base };
  }

  it('refuses an edit of a text changed in another tab, names it and writes nothing (409)', async () => {
    // Tab 2 saved «Другая вкладка» while tab 1 still shows the default.
    await fixtures.store({ key: CURSOR, locale: Locale.RU, value: 'Другая вкладка', editedAt: EDITED_AT });
    const response = await save<ApiErrorResponse>([
      text(SFX, Locale.RU, { value: 'Новый звук', base: ru(SFX) }),
      text(CURSOR, Locale.RU, { value: 'Моя правка', base: ru(CURSOR) }),
    ]);
    strictEqual(response.status, 409);
    deepStrictEqual(response.body, {
      statusCode: 409,
      error: 'conflict',
      key: 'admin.siteTexts.errors.conflict',
      details: { [`${CURSOR}.ru`]: 'Другая вкладка' },
    });
    strictEqual((await fixtures.find(CURSOR, Locale.RU))?.value, 'Другая вкладка');
    strictEqual((await fixtures.find(SFX, Locale.RU))?.value, ru(SFX));
  });

  it('saves the edits of a stale tab that do not collide (trimmed, marked edited), leaving the newer text', async () => {
    await fixtures.store({ key: CURSOR, locale: Locale.RU, value: 'Другая вкладка', editedAt: EDITED_AT });
    const response = await save([text(SFX, Locale.RU, { value: ' Новый звук ', base: ru(SFX) })]);
    strictEqual(response.status, 200);
    deepStrictEqual(response.body, { saved: 1, values: { [SFX]: { ru: 'Новый звук' } } });
    const stored = await fixtures.find(SFX, Locale.RU);
    strictEqual(stored?.value, 'Новый звук');
    ok(stored?.editedAt instanceof Date);
    strictEqual((await fixtures.find(CURSOR, Locale.RU))?.value, 'Другая вкладка');
  });

  it('creates a missing row with the default and never writes a resent text over a row', async () => {
    await app.database.client.message.delete({ where: { key_locale: { key: CURSOR, locale: Locale.EN } } });
    await fixtures.store({ key: CURSOR, locale: Locale.RU, value: 'Другая вкладка', editedAt: EDITED_AT });
    const response = await save([
      { key: CURSOR, values: { ru: { value: ru(CURSOR), base: ru(CURSOR) }, en: { value: 'Old', base: 'Old' } } },
    ]);
    deepStrictEqual(response.body, { saved: 1, values: { [CURSOR]: { ru: 'Другая вкладка', en: en(CURSOR) } } });
    deepStrictEqual(await fixtures.find(CURSOR, Locale.EN), {
      key: CURSOR,
      locale: Locale.EN,
      value: en(CURSOR),
      editedAt: null,
    });
    strictEqual((await fixtures.find(CURSOR, Locale.RU))?.value, 'Другая вкладка');
  });

  it('stores a value equal to the default as «по умолчанию» and reports «no changes» for nothing new', async () => {
    await fixtures.store({ key: SFX, locale: Locale.EN, value: 'Hiss', editedAt: EDITED_AT });
    const restored = await save([text(SFX, Locale.EN, { value: en(SFX), base: 'Hiss' })]);
    deepStrictEqual(restored.body, { saved: 1, values: { [SFX]: { en: en(SFX) } } });
    strictEqual((await fixtures.find(SFX, Locale.EN))?.editedAt, null);
    deepStrictEqual((await save([text(SFX, Locale.EN, { value: en(SFX), base: en(SFX) })])).body, {
      saved: 0,
      values: { [SFX]: { en: en(SFX) } },
    });
    deepStrictEqual((await save([], [])).body, { saved: 0, values: {} });
  });

  it('saves a picked landing image and refuses one replaced in another tab meanwhile', async () => {
    const [first, second, third] = [
      await fixtures.createMedia(admin.id),
      await fixtures.createMedia(admin.id),
      await fixtures.createMedia(admin.id),
    ];
    await fixtures.storeImage({ key: IMAGE, mediaId: first });
    deepStrictEqual((await save([], [image(second, first)])).body, { saved: 1, values: {} });
    strictEqual(await fixtures.findImageMedia(IMAGE), second);
    const stale = await save<ApiErrorResponse>([], [image(third, first)]);
    strictEqual(stale.status, 409);
    deepStrictEqual(stale.body.details, { [IMAGE]: true });
    strictEqual(await fixtures.findImageMedia(IMAGE), second);
    deepStrictEqual((await save([], [image(null, second)])).body, { saved: 1, values: {} });
    strictEqual(await fixtures.findImageMedia(IMAGE), null);
  });

  it('checks every edited value, key and image («Исправьте ошибки в текстах») and writes nothing', async () => {
    const response = await save<ApiValidationErrorResponse>(
      [
        text('footer.top', Locale.RU, { value: '', base: ru('footer.top') }),
        text('catalog.models', Locale.EN, { value: '{total} models', base: en('catalog.models') }),
        text('zzz.unknown', Locale.RU, { value: 'x', base: 'y' }),
        text(SFX, Locale.RU, { value: 'Новый звук', base: ru(SFX) }),
      ],
      [{ key: 'hero.image', mediaId: null, base: null }],
    );
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      '': { key: 'admin.siteTexts.errors.fixErrors' },
      'footer.top.ru': { key: 'admin.siteTexts.errors.required' },
      'catalog.models.en': {
        key: 'admin.siteTexts.errors.unknownArgument',
        values: { token: '{total}', allowed: '{count}' },
      },
      'zzz.unknown': { key: 'admin.siteTexts.errors.unknownKey' },
      'hero.image': { key: 'admin.siteTexts.errors.unknownImage' },
    });
    strictEqual((await fixtures.find(SFX, Locale.RU))?.value, ru(SFX));
  });

  it('refuses a picked image that is no longer in the media library', async () => {
    const response = await save<ApiValidationErrorResponse>([], [image(randomUUID(), null)]);
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      '': { key: 'admin.errors.missingMedia' },
      [IMAGE]: { key: 'admin.errors.missingMedia' },
    });
  });

  it('refuses a malformed request with the field paths of the request', async () => {
    const cases: ReadonlyArray<readonly [unknown, unknown, Record<string, unknown>]> = [
      [
        [text(SFX, Locale.RU, { value: 'x'.repeat(10_001), base: '' })],
        [],
        {
          'entries.0.values.ru.value': { key: 'admin.validation.tooLong', values: { max: 10_000 } },
        },
      ],
      [
        [text(SFX, Locale.RU, { value: 'a', base: '' }), text(` ${SFX} `, Locale.EN, { value: 'b', base: '' })],
        [],
        {
          entries: { key: 'admin.validation.textsDuplicate' },
        },
      ],
      [[{ key: ' ', values: {} }], [], { 'entries.0.key': { key: 'admin.validation.keyRequired' } }],
      [
        [{ key: SFX, values: { de: { value: 'x', base: '' } } }],
        [],
        {
          'entries.0.values.de': { key: 'admin.validation.unknownField' },
        },
      ],
      [[{ key: SFX, values: { ru: null } }], [], { 'entries.0.values.ru': { key: 'admin.validation.invalid' } }],
      [
        [],
        [{ key: IMAGE, mediaId: 'not-a-uuid', base: null }],
        {
          'images.0.mediaId': { key: 'admin.validation.idInvalid' },
        },
      ],
      [[], [image(null, null), image(null, null)], { images: { key: 'admin.validation.imagesDuplicate' } }],
      ['x', [], { entries: { key: 'admin.validation.invalid' } }],
    ];
    for (const [entries, images, fields] of cases) {
      const response = await save<ApiValidationErrorResponse>(entries, images);
      strictEqual(response.status, 400, JSON.stringify(entries));
      deepStrictEqual(response.body.fields, fields, JSON.stringify(entries));
    }
  });

  it('serializes concurrent saves of one text under the lock: one is stored, the other conflicts', async () => {
    const [first, second] = await Promise.all([
      save([text(SFX, Locale.RU, { value: 'Вкладка 1', base: ru(SFX) })]),
      save([text(SFX, Locale.RU, { value: 'Вкладка 2', base: ru(SFX) })]),
    ]);
    deepStrictEqual([first.status, second.status].sort(), [200, 409]);
    const winner = first.status === 200 ? 'Вкладка 1' : 'Вкладка 2';
    strictEqual((await fixtures.find(SFX, Locale.RU))?.value, winner);
  });

  it('waits for the «Тексты сайта» lock: no other save or reset runs in between', async () => {
    const [locked, released] = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
    const holder = app.database.client.$transaction(async transaction => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${SiteTextsStore.LOCK_NAMESPACE}::int4, ${SiteTextsStore.LOCK_KEY}::int4)`;
      locked.resolve();
      await released.promise;
    });
    await locked.promise;
    const pending = save([text(SFX, Locale.RU, { value: 'После блокировки', base: ru(SFX) })]);
    const early = await Promise.race([pending.then(() => 'saved'), setTimeout(300, 'waiting')]);
    strictEqual((await fixtures.find(SFX, Locale.RU))?.value, ru(SFX));
    released.resolve();
    await holder;
    deepStrictEqual([early, (await pending).status], ['waiting', 200]);
  });

  it('refreshes the site messages after a save (the public site shows the edit at once)', async () => {
    const sfxOf = async (): Promise<unknown> => {
      const response = await app.api.get<SiteMessagesResponse>(SITE_MESSAGES_ROUTE.replace(':locale', 'ru'));
      const hero = response.body.messages.hero;
      return typeof hero === 'object' ? hero.sfx : undefined;
    };
    strictEqual(await sfxOf(), ru(SFX));
    await save([text(SFX, Locale.RU, { value: 'Шипение', base: ru(SFX) })]);
    strictEqual(await sfxOf(), 'Шипение');
  });
});
