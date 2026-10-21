import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { SiteTextCounters } from '~core/site-texts/site-text-counters';
import { SiteTextKind } from '~core/site-texts/site-text-kind.enum';
import { SiteTextQuery } from '~core/site-texts/site-text-query';
import { StoredSiteText } from '~core/site-texts/site-text-row-index';

import { SiteTextsTestKit } from './test/site-texts-test-kit';

/** Port of the frontend's buildSiteTextEntries / counters / search tests (src/lib/admin/site-texts.test.ts). */
const kit = new SiteTextsTestKit();
const EDITED_AT = new Date('2026-10-20T10:00:00.000Z');
const plainKey = kit.firstKey(
  key => kit.definitions.find(key)?.format.arguments.length === 0 && kit.defaultOf(key, Locale.RU).length > 3,
  'plain text',
);
const argumentKey = kit.firstKey(key => (kit.definitions.find(key)?.format.arguments.length ?? 0) > 0, 'an {argument}');

function row(key: string, locale: Locale, value: string): StoredSiteText {
  return { key, locale, value, editedAt: null };
}

/** A row edited in the admin (at EDITED_AT). */
function edited(key: string, locale: Locale, value: string): StoredSiteText {
  return { key, locale, value, editedAt: EDITED_AT };
}

function entryOf(key: string, rows: readonly StoredSiteText[]) {
  const entry = kit.entries.build(rows).find(item => item.definition.key === key);
  ok(entry !== undefined, key);
  return entry;
}

describe('SiteTextEntriesBuilder', () => {
  it('shows the defaults while rows are missing', () => {
    const entry = entryOf(plainKey, []);
    strictEqual(entry.values.ru, kit.defaultOf(plainKey, Locale.RU));
    deepStrictEqual(entry.missing, [...LocaleMap.LOCALES]);
    deepStrictEqual(entry.edited, {});
  });

  it('shows stored values and marks edited locales; rows of other locales are ignored', () => {
    const rows = [
      edited(plainKey, Locale.RU, 'Новый текст'),
      row(plainKey, Locale.EN, kit.defaultOf(plainKey, Locale.EN)),
      { key: plainKey, locale: 'de', value: 'Deutsch', editedAt: EDITED_AT },
    ];
    const entry = entryOf(plainKey, rows);
    strictEqual(entry.values.ru, 'Новый текст');
    deepStrictEqual(entry.edited, { ru: EDITED_AT.toISOString() });
    deepStrictEqual(entry.missing, []);
  });

  it('lists the {arguments} of the default and detects ICU', () => {
    const entry = entryOf(argumentKey, []);
    ok(entry.definition.format.arguments.length > 0);
    strictEqual(entry.definition.kind, SiteTextKind.ICU);
  });

  it('lists every site text in the order of ru.json', () => {
    deepStrictEqual(
      kit.entries.build([]).map(entry => entry.definition.key),
      kit.catalog.siteKeys(),
    );
  });
});

describe('SiteTextCounters (section tabs, dashboard)', () => {
  it('counts an empty translation of a filled Russian text as a gap', () => {
    const state = (ru: string, en: string) => ({ values: { ru, en }, edited: {}, missing: [] });
    ok(SiteTextCounters.hasTranslationGap(state('Текст', '')));
    ok(SiteTextCounters.hasTranslationGap(state('Текст', '  ')));
    ok(!SiteTextCounters.hasTranslationGap(state('', '')));
    ok(!SiteTextCounters.hasTranslationGap(state('Текст', 'Text')));
  });

  it('summarizes edited, untranslated and unsaved texts', () => {
    const defaults = kit.catalog
      .siteKeys()
      .flatMap(key => LocaleMap.LOCALES.map(locale => row(key, locale, kit.defaultOf(key, locale))));
    const rows = [
      ...defaults.filter(item => item.key !== plainKey),
      edited(plainKey, Locale.RU, 'Другой текст'),
      edited(plainKey, Locale.EN, ''),
    ];
    const section = plainKey.slice(0, plainKey.indexOf('.'));
    const own = kit.entries.build(rows).filter(entry => entry.definition.section === section);
    const counters = SiteTextCounters.of(own);
    deepStrictEqual(
      { edited: counters.edited, gaps: counters.gaps, unsaved: counters.unsaved, total: counters.total },
      { edited: 1, gaps: 1, unsaved: 0, total: own.length },
    );
    strictEqual(SiteTextCounters.of(kit.entries.build([])).unsaved, kit.catalog.siteKeys().length);
  });
});

describe('SiteTextQuery (the «Тексты сайта» search)', () => {
  it('matches case- and ё-insensitively, inner whitespace collapsed', () => {
    ok(SiteTextQuery.parse('ежик').matchesAny(['Ёжик в тумане']));
    ok(SiteTextQuery.parse('ЁЖИК В').matchesAny(['ёжик   в тумане']));
    ok(SiteTextQuery.parse(plainKey.toUpperCase()).matchesAny([plainKey]));
    ok(!SiteTextQuery.parse('совсем-не-найдётся-42').matchesAny(['Ёжик в тумане', plainKey]));
  });

  it('normalizes the query', () => {
    strictEqual(SiteTextQuery.parse('  два   слова ').toString(), 'два слова');
    ok(SiteTextQuery.parse(undefined).isEmpty());
    ok(SiteTextQuery.parse('   ').isEmpty());
    strictEqual(SiteTextQuery.parse('x'.repeat(500)).toString().length, SiteTextQuery.MAX_LENGTH);
  });
});
