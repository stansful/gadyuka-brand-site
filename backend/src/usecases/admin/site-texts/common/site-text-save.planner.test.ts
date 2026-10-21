import { deepStrictEqual, ok } from 'node:assert';
import { describe, it } from 'node:test';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { SiteImageSavePlanner } from '~core/site-texts/site-image-save.planner';
import { StoredSiteText } from '~core/site-texts/site-text-row-index';
import { SiteTextChange, SiteTextSavePlanner } from '~core/site-texts/site-text-save.planner';

import { SiteTextsTestKit } from './test/site-texts-test-kit';

/** Port of the frontend's planSiteTextSave / planSiteTextWrites / planSiteImageSave tests. */
const kit = new SiteTextsTestKit();
const planner = new SiteTextSavePlanner(kit.catalog);
const TITLE = 'hero.title';
const SLOGAN = 'hero.slogan';
const EDITED_AT = new Date('2026-10-20T10:00:00.000Z');
const NOW = new Date('2026-10-21T12:00:00.000Z');

function row(key: string, locale: Locale, value: string): StoredSiteText {
  return { key, locale, value, editedAt: null };
}

/** A row edited in the admin (at EDITED_AT). */
function edited(key: string, locale: Locale, value: string): StoredSiteText {
  return { key, locale, value, editedAt: EDITED_AT };
}

function defaultRows(...keys: string[]): StoredSiteText[] {
  return keys.flatMap(key => LocaleMap.LOCALES.map(locale => row(key, locale, kit.defaultOf(key, locale))));
}

function change(key: string, locale: Locale, edit: { value: string; base: string }): SiteTextChange {
  return { key, locale, ...edit };
}

describe('SiteTextSavePlanner.plan (lost updates across tabs)', () => {
  const title = kit.defaultOf(TITLE, Locale.RU);
  const slogan = kit.defaultOf(SLOGAN, Locale.RU);

  it('refuses an edit whose row was changed elsewhere since the editor loaded it — nothing is written', () => {
    // Tab 2 saved «ГАДЮКА 2.0»; tab 1 still edits from the default.
    const rows = [...defaultRows(SLOGAN), edited(TITLE, Locale.RU, 'ГАДЮКА 2.0')];
    const plan = planner.plan(
      [
        change(SLOGAN, Locale.RU, { value: 'Новый слоган', base: slogan }),
        change(TITLE, Locale.RU, { value: 'Моя правка', base: title }),
      ],
      rows,
      NOW,
    );
    deepStrictEqual(plan.conflicts, [{ key: TITLE, locale: Locale.RU, current: 'ГАДЮКА 2.0' }]);
    deepStrictEqual(plan.writes, []);
  });

  it('writes an edit that still starts from the stored text', () => {
    const plan = planner.plan(
      [change(SLOGAN, Locale.RU, { value: 'Новый слоган', base: slogan })],
      defaultRows(SLOGAN),
      NOW,
    );
    deepStrictEqual(plan.conflicts, []);
    deepStrictEqual(plan.writes, [{ key: SLOGAN, locale: Locale.RU, value: 'Новый слоган', editedAt: NOW }]);
    deepStrictEqual(plan.stored, { [SLOGAN]: { ru: 'Новый слоган' } });
  });

  it('is no conflict when the row already holds the same edit (another tab saved the same text)', () => {
    const rows = [edited(SLOGAN, Locale.RU, 'Новый слоган')];
    const plan = planner.plan([change(SLOGAN, Locale.RU, { value: 'Новый слоган', base: slogan })], rows, NOW);
    deepStrictEqual(plan, { conflicts: [], writes: [], stored: { [SLOGAN]: { ru: 'Новый слоган' } } });
  });

  it('compares the edit with the default while the row is missing', () => {
    const english = kit.defaultOf(SLOGAN, Locale.EN);
    const fresh = planner.plan([change(SLOGAN, Locale.EN, { value: 'Remember', base: english })], [], NOW);
    deepStrictEqual(fresh.writes, [{ key: SLOGAN, locale: Locale.EN, value: 'Remember', editedAt: NOW }]);
    const stale = planner.plan([change(SLOGAN, Locale.EN, { value: 'Remember', base: 'An older default' })], [], NOW);
    deepStrictEqual(stale.conflicts, [{ key: SLOGAN, locale: Locale.EN, current: english }]);
  });

  it('never writes a resent stored text over a row: it only creates a missing row, with the default', () => {
    const rows = [edited(TITLE, Locale.RU, 'ГАДЮКА 2.0')];
    const plan = planner.plan(
      [
        // Stale but untouched: the row keeps tab 2's text.
        change(TITLE, Locale.RU, { value: title, base: title }),
        // No row yet: created with the default (not with an outdated value the tab loaded).
        change(TITLE, Locale.EN, { value: 'An older default', base: 'An older default' }),
      ],
      rows,
      NOW,
    );
    const english = kit.defaultOf(TITLE, Locale.EN);
    deepStrictEqual(plan.conflicts, []);
    deepStrictEqual(plan.writes, [{ key: TITLE, locale: Locale.EN, value: english, editedAt: null }]);
    deepStrictEqual(plan.stored, { [TITLE]: { ru: 'ГАДЮКА 2.0', en: english } });
  });

  it('treats whitespace around the base as no edit (the request trims only the value)', () => {
    const rows = [row(SLOGAN, Locale.RU, ` ${slogan} `)];
    deepStrictEqual(planner.plan([change(SLOGAN, Locale.RU, { value: slogan, base: ` ${slogan} ` })], rows, NOW), {
      conflicts: [],
      writes: [],
      stored: { [SLOGAN]: { ru: ` ${slogan} ` } },
    });
  });
});

describe('SiteTextSavePlanner.writesOf / resetWrites (only what changes, editedAt by the default)', () => {
  const ru = kit.defaultOf(SLOGAN, Locale.RU);
  const en = kit.defaultOf(SLOGAN, Locale.EN);
  const value = (locale: Locale, text: string) => ({ key: SLOGAN, locale, value: text });

  it('writes nothing for untouched defaults', () => {
    deepStrictEqual(planner.writesOf([value(Locale.RU, ru), value(Locale.EN, en)], defaultRows(SLOGAN), NOW), []);
  });

  it('marks a changed value as edited and keeps an unchanged edit as is', () => {
    const rows = [edited(SLOGAN, Locale.RU, 'Правка'), row(SLOGAN, Locale.EN, en)];
    deepStrictEqual(planner.writesOf([value(Locale.RU, 'Правка'), value(Locale.EN, 'Edit')], rows, NOW), [
      { key: SLOGAN, locale: Locale.EN, value: 'Edit', editedAt: NOW },
    ]);
  });

  it('stores a value equal to the default as «по умолчанию» (editedAt = null)', () => {
    const rows = [edited(SLOGAN, Locale.RU, 'Правка'), row(SLOGAN, Locale.EN, en)];
    deepStrictEqual(planner.writesOf([value(Locale.RU, ru)], rows, NOW), [
      { key: SLOGAN, locale: Locale.RU, value: ru, editedAt: null },
    ]);
  });

  it('creates missing rows and stores an emptied translation as an edit', () => {
    deepStrictEqual(planner.writesOf([value(Locale.RU, ru)], [], NOW), [
      { key: SLOGAN, locale: Locale.RU, value: ru, editedAt: null },
    ]);
    deepStrictEqual(planner.writesOf([value(Locale.EN, '')], defaultRows(SLOGAN), NOW), [
      { key: SLOGAN, locale: Locale.EN, value: '', editedAt: NOW },
    ]);
  });

  it('resets every locale to its default', () => {
    deepStrictEqual(
      planner.resetWrites(SLOGAN),
      LocaleMap.LOCALES.map(locale => ({ key: SLOGAN, locale, value: kit.defaultOf(SLOGAN, locale), editedAt: null })),
    );
  });

  it('knows an edit from a resent stored text', () => {
    ok(SiteTextSavePlanner.isEdit({ value: 'Новый', base: 'Старый' }));
    ok(!SiteTextSavePlanner.isEdit({ value: 'Текст', base: ' Текст ' }));
  });
});

describe('SiteImageSavePlanner', () => {
  const images = new SiteImageSavePlanner();

  it('writes a picked image that replaces what is stored', () => {
    deepStrictEqual(
      images.plan([{ key: 'about.image', mediaId: 'm2', base: 'm1' }], [{ key: 'about.image', mediaId: 'm1' }]),
      { conflicts: [], writes: [{ key: 'about.image', mediaId: 'm2' }] },
    );
    deepStrictEqual(images.plan([{ key: 'about.image', mediaId: 'm2', base: null }], []), {
      conflicts: [],
      writes: [{ key: 'about.image', mediaId: 'm2' }],
    });
    deepStrictEqual(
      images.plan([{ key: 'about.image', mediaId: null, base: 'm1' }], [{ key: 'about.image', mediaId: 'm1' }]),
      {
        conflicts: [],
        writes: [{ key: 'about.image', mediaId: null }],
      },
    );
  });

  it('refuses an image replaced elsewhere meanwhile, and skips unchanged ones', () => {
    const rows = [
      { key: 'about.image', mediaId: 'm3' },
      { key: 'tailoring.image', mediaId: 'm9' },
    ];
    deepStrictEqual(
      images.plan(
        [
          { key: 'about.image', mediaId: 'm2', base: 'm1' },
          { key: 'tailoring.image', mediaId: 'm1', base: 'm1' },
        ],
        rows,
      ),
      { conflicts: ['about.image'], writes: [] },
    );
    deepStrictEqual(images.plan([{ key: 'about.image', mediaId: 'm3', base: 'm1' }], rows), {
      conflicts: [],
      writes: [],
    });
  });
});
