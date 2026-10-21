import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { SiteTextEntry, SiteTextGroup, SiteTextsPageResponse } from '~shared/contracts/site-texts';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { SiteTextRegistry } from '~core/site-texts/site-text-registry';
import { MessageCatalog, MessagesDirectory } from '~module/messages';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { SiteTextFixtures } from '~usecases/admin/site-texts/common/test/site-text-fixtures';

import { SITE_TEXTS_PAGE_ROUTE } from './site-texts-page.route';

describe('[e2e] GET /api/v1/admin/site-texts', () => {
  /** Keys only this file writes (other files may write other rows meanwhile: assertions stay on these). */
  const ISSUE = 'hero.issue';
  const ISSUE_META = 'hero.issueMeta';
  const HINT = 'hero.hint';
  const IMAGE = 'about.image';
  const EDITED_AT = new Date('2026-10-20T10:00:00.000Z');
  const catalog = new MessageCatalog(MessagesDirectory.locate());
  const keysOf = (section: string): string[] => catalog.siteKeys().filter(key => key.startsWith(`${section}.`));
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: SiteTextFixtures;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = await SiteTextFixtures.capture(app.database, { keys: [ISSUE, ISSUE_META, HINT], imageKeys: [IMAGE] });
    await fixtures.clear();
  });

  after(async () => {
    await fixtures.restore();
    await admin.remove();
    await app.stop();
  });

  function page<T = SiteTextsPageResponse>(query: Record<string, string> = {}) {
    return app.api.get<T>(`${SITE_TEXTS_PAGE_ROUTE}?${new URLSearchParams(query).toString()}`, { accessToken });
  }

  function entryOf(group: SiteTextGroup | undefined, key: string): SiteTextEntry {
    const entry = group?.entries.find(item => item.key === key);
    ok(entry !== undefined, key);
    return entry;
  }

  it('answers the section tabs and «hero» by default: its texts in ru.json order, defaults while rows are missing', async () => {
    await fixtures.clear();
    const response = await page();
    strictEqual(response.status, 200);
    const { sections, mode, section, query, groups } = response.body;
    deepStrictEqual({ mode, section, query }, { mode: 'section', section: 'hero', query: '' });
    deepStrictEqual(
      sections.map(tab => tab.id),
      new SiteTextRegistry().sectionIds(),
    );
    sections.forEach(tab => strictEqual(tab.total, keysOf(tab.id).length, tab.id));
    deepStrictEqual(
      groups.map(group => [group.section, group.entries.map(entry => entry.key), group.images]),
      [['hero', keysOf('hero'), []]],
    );
    deepStrictEqual(entryOf(groups[0], ISSUE), {
      key: ISSUE,
      kind: 'text',
      required: false,
      values: { ru: catalog.siteDefault(ISSUE, Locale.RU), en: catalog.siteDefault(ISSUE, Locale.EN) },
      defaults: { ru: catalog.siteDefault(ISSUE, Locale.RU), en: catalog.siteDefault(ISSUE, Locale.EN) },
      edited: {},
      missing: ['ru', 'en'],
      placeholders: [],
      tags: [],
    });
    deepStrictEqual(entryOf(groups[0], 'hero.heading').placeholders, ['title', 'subtitle']);
  });

  it('marks edited texts, translation gaps and missing rows in the entries and in the tab counters', async () => {
    await fixtures.store({ key: ISSUE, locale: Locale.RU, value: 'Зима ’27', editedAt: EDITED_AT });
    await fixtures.store({ key: ISSUE, locale: Locale.EN, value: '', editedAt: EDITED_AT });
    for (const locale of LocaleMap.LOCALES) {
      await fixtures.store({ key: ISSUE_META, locale, value: catalog.siteDefault(ISSUE_META, locale), editedAt: null });
    }
    const { sections, groups } = (await page({ section: 'hero' })).body;
    const issue = entryOf(groups[0], ISSUE);
    deepStrictEqual(
      [issue.values, issue.edited, issue.missing],
      [{ ru: 'Зима ’27', en: '' }, { ru: EDITED_AT.toISOString(), en: EDITED_AT.toISOString() }, []],
    );
    deepStrictEqual([entryOf(groups[0], ISSUE_META).edited, entryOf(groups[0], ISSUE_META).missing], [{}, []]);
    const entries = groups[0]?.entries ?? [];
    deepStrictEqual(
      sections.find(tab => tab.id === 'hero'),
      {
        id: 'hero',
        total: entries.length,
        edited: entries.filter(entry => Object.keys(entry.edited).length > 0).length,
        gaps: entries.filter(entry => entry.values.ru.trim() !== '' && entry.values.en.trim() === '').length,
        unsaved: entries.filter(entry => entry.missing.length > 0).length,
      },
    );
  });

  it('falls back to «hero» for an unknown section and shows a section with its landing images', async () => {
    strictEqual((await page({ section: 'nope' })).body.section, 'hero');
    const mediaId = await fixtures.createMedia(admin.id);
    await fixtures.storeImage({ key: IMAGE, mediaId });
    const about = (await page({ section: 'about' })).body;
    strictEqual(about.section, 'about');
    deepStrictEqual(
      about.groups[0]?.images.map(item => [item.key, item.media?.id, item.media?.alt]),
      [[IMAGE, mediaId, { ru: 'Фото', en: 'Photo' }]],
    );
    ok(about.groups[0]?.images[0]?.media?.url.startsWith('/media/admin/'));
    await fixtures.storeImage({ key: IMAGE, mediaId: null });
    deepStrictEqual((await page({ section: 'about' })).body.groups[0]?.images, [{ key: IMAGE, media: null }]);
  });

  it('searches every section: key, admin label, current or default text — case- and «ё»-insensitive', async () => {
    await fixtures.store({ key: HINT, locale: Locale.RU, value: 'Ёлочный тест 7f3a9', editedAt: EDITED_AT });
    const found = (await page({ q: '  елочный   ТЕСТ 7f3a9 ', section: 'about' })).body;
    deepStrictEqual(
      { mode: found.mode, section: found.section, query: found.query },
      {
        mode: 'search',
        section: null,
        query: 'елочный ТЕСТ 7f3a9',
      },
    );
    deepStrictEqual(
      found.groups.map(group => [group.section, group.entries.map(entry => entry.key), group.images]),
      [['hero', [HINT], []]],
    );
    const searches = ['Преимущество 1: заголовок', 'Original designs', 'about.advantages.0.TITLE'];
    for (const q of searches) {
      const keys = (await page({ q })).body.groups.flatMap(group => group.entries.map(entry => entry.key));
      ok(keys.includes('about.advantages.0.title'), q);
    }
    ok((await page({ q: 'x'.repeat(500) })).body.query.length === 100);
    deepStrictEqual((await page({ q: 'совсем-не-найдётся-42' })).body.groups, []);
    strictEqual((await page({ q: '   ' })).body.mode, 'section');
  });

  it('refuses a repeated query parameter', async () => {
    const response = await app.api.get<ApiValidationErrorResponse>(`${SITE_TEXTS_PAGE_ROUTE}?q=a&q=b`, {
      accessToken,
    });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, { q: { key: 'admin.validation.invalid' } });
  });
});
