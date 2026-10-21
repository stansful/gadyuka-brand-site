import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { MessageCatalog, MessagesDirectory } from '~module/messages';

import { SeedMode } from '../run/seed-mode.enum';
import { StoredSiteMessage } from './site-message-seed.interfaces';
import { SiteMessageSeedPlanner } from './site-message-seed.planner';

const catalog = new MessageCatalog(MessagesDirectory.locate());
const planner = new SiteMessageSeedPlanner(catalog);
const EDITED_AT = new Date('2026-10-01T00:00:00.000Z');

/** A row holding the default of every key × locale (as after a first seed). */
const seededRows = (): StoredSiteMessage[] =>
  planner.defaults().map(({ key, locale, value }) => ({ key, locale, value, editedAt: null }));

/** The seeded rows with some replaced (matched by locale + key). */
const withRows = (changed: readonly StoredSiteMessage[]): StoredSiteMessage[] => {
  const ids = new Set(changed.map(row => `${row.locale}:${row.key}`));
  return [...seededRows().filter(row => !ids.has(`${row.locale}:${row.key}`)), ...changed];
};

describe('SiteMessageSeedPlanner (shared/messages → Message rows)', () => {
  const total = catalog.siteKeys().length * LocaleMap.LOCALES.length;

  it('creates a row with the default for every key × locale of an empty table', () => {
    const plan = planner.plan([], SeedMode.KEEP_EDITS);
    strictEqual(plan.creates.length, total);
    deepStrictEqual(plan.creates[0], {
      key: catalog.siteKeys()[0],
      locale: Locale.RU,
      value: catalog.siteDefault(catalog.siteKeys()[0] ?? '', Locale.RU),
    });
    deepStrictEqual([plan.updates.length, plan.keptEdited, plan.orphans.length], [0, 0, 0]);
  });

  it('changes nothing when every row holds its default (a second run)', () => {
    for (const mode of [SeedMode.KEEP_EDITS, SeedMode.OVERWRITE]) {
      const plan = planner.plan(seededRows(), mode);
      deepStrictEqual([plan.creates.length, plan.updates.length, plan.keptEdited], [0, 0, 0], mode);
    }
  });

  it('rolls a new default out to seed rows, keeps edited rows', () => {
    const plan = planner.plan(
      withRows([
        { key: 'hero.title', locale: 'en', value: 'Old default', editedAt: null },
        { key: 'about.title', locale: 'ru', value: 'Правка админа', editedAt: EDITED_AT },
        {
          key: 'footer.copyright',
          locale: 'en',
          value: catalog.siteDefault('footer.copyright', Locale.EN),
          editedAt: EDITED_AT,
        },
      ]),
      SeedMode.KEEP_EDITS,
    );
    deepStrictEqual(plan.updates, [
      { key: 'hero.title', locale: Locale.EN, value: catalog.siteDefault('hero.title', Locale.EN) },
    ]);
    strictEqual(plan.keptEdited, 2);
    strictEqual(plan.creates.length, 0);
  });

  it('SEED_OVERWRITE resets every differing or edited row (an edited row equal to the default too)', () => {
    const plan = planner.plan(
      withRows([
        { key: 'hero.title', locale: 'en', value: 'Old default', editedAt: null },
        { key: 'about.title', locale: 'ru', value: 'Правка админа', editedAt: EDITED_AT },
        {
          key: 'footer.copyright',
          locale: 'en',
          value: catalog.siteDefault('footer.copyright', Locale.EN),
          editedAt: EDITED_AT,
        },
      ]),
      SeedMode.OVERWRITE,
    );
    deepStrictEqual(plan.updates.map(update => `${update.locale}:${update.key}`).sort(), [
      'en:footer.copyright',
      'en:hero.title',
      'ru:about.title',
    ]);
    strictEqual(plan.keptEdited, 0);
  });

  it('reports orphans (unknown keys, removed locales, branches) once each and never plans them', () => {
    const orphans: StoredSiteMessage[] = [
      { key: 'removed.key', locale: 'ru', value: 'x', editedAt: null },
      { key: 'removed.key', locale: 'ru', value: 'x', editedAt: EDITED_AT },
      { key: 'hero.title', locale: 'de', value: 'Titel', editedAt: null },
      { key: 'hero', locale: 'en', value: 'branch', editedAt: null },
    ];
    for (const mode of [SeedMode.KEEP_EDITS, SeedMode.OVERWRITE]) {
      const plan = planner.plan([...seededRows(), ...orphans], mode);
      deepStrictEqual(plan.orphans, ['ru:removed.key', 'de:hero.title', 'en:hero']);
      deepStrictEqual([plan.creates.length, plan.updates.length], [0, 0]);
    }
  });

  it('creates only the missing rows of a new key or a new locale', () => {
    const rows = seededRows().filter(row => !(row.key === 'hero.title' && row.locale === 'en'));
    const plan = planner.plan(rows, SeedMode.KEEP_EDITS);
    deepStrictEqual(plan.creates, [
      { key: 'hero.title', locale: Locale.EN, value: catalog.siteDefault('hero.title', Locale.EN) },
    ]);
  });
});
