import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { MessageCatalog, MessagesDirectory } from '~module/messages';

import { SeedCopyLoader } from '../copy/seed-copy.loader';
import { SeedAssetsDirectory } from '../media/seed-assets-directory';
import { DEMO_MENU, DEMO_SETTINGS } from './demo-entities.constants';
import { DemoEntityCatalog } from './demo-entity.catalog';
import { SEED_MEDIA_KEYS } from './seed-media-key.enum';
import { SEED_MEDIA_SOURCES } from './seed-media.sources';
import { SeedRowIds } from './seed-row-ids';

/**
 * Owner rule: the collection «Меня запомнят» is never described as first / debut / №1 — in any
 * language. Product numbers (#01…#04) are fine: they number products, not issues.
 */
const FORBIDDEN = [/перв/i, /дебют/i, /\bfirst\b/i, /\bdebut/i, /№\s*0*1\b/, /\bno\.?\s*0*1\b/i, /issue\s*#?\s*0*1\b/i];

const messagesDirectory = MessagesDirectory.locate();
const copy = new SeedCopyLoader(messagesDirectory).load();
const site = new MessageCatalog(messagesDirectory);
const catalog = new DemoEntityCatalog(copy, new SeedRowIds());

/** Every string inside a value (objects, arrays, nested). */
class TextCollector {
  collect(value: unknown): string[] {
    if (typeof value === 'string') {
      return [value];
    }
    if (typeof value !== 'object' || value === null || value instanceof Date) {
      return [];
    }
    return Object.values(value).flatMap(child => this.collect(child));
  }
}

/** Every demo row the catalog builds (throws on a missing text). */
const allRows = (): unknown[] => [
  catalog.collection(),
  catalog.products(),
  catalog.reviews(),
  catalog.news(),
  catalog.gallery(),
  catalog.offers(),
  catalog.partners(),
  catalog.menu(),
  catalog.socialLinks(),
  catalog.settings(),
];

describe('seed copy (shared/messages/content) and demo entities', () => {
  it('never calls the collection first / debut / №1', () => {
    const texts = new TextCollector().collect([
      LocaleMap.build(locale => site.siteDefaults(locale)),
      LocaleMap.build(locale => copy.textsOf(locale)),
      allRows(),
    ]);
    deepStrictEqual(
      texts.filter(text => FORBIDDEN.some(pattern => pattern.test(text))),
      [],
    );
  });

  it('has the same, non-empty entity copy in every locale', () => {
    const reference = Object.keys(copy.textsOf(Locale.RU)).sort();
    for (const locale of LocaleMap.LOCALES) {
      const texts = copy.textsOf(locale);
      deepStrictEqual(Object.keys(texts).sort(), reference, locale);
      deepStrictEqual(
        Object.entries(texts).filter(([, text]) => text.trim() === ''),
        [],
        locale,
      );
    }
  });

  it('resolves every localized seed field for every locale', () => {
    const fields = [
      catalog.collection().title,
      ...catalog.products().flatMap(product => [product.title, product.description, product.details]),
      ...catalog.reviews().flatMap(review => [review.role, review.text]),
      ...catalog.news().flatMap(item => [item.title, item.excerpt, item.body]),
      ...catalog.menu().map(item => item.label),
      ...SEED_MEDIA_KEYS.map(key => catalog.mediaAlt(key)),
    ];
    for (const field of fields) {
      deepStrictEqual(Object.keys(field), [...LocaleMap.LOCALES]);
    }
    deepStrictEqual(
      catalog.reviews().map(review => review.author),
      ['Сергей', 'Анна', 'Дмитрий'],
    );
  });

  it('has an alt text for every seed image, and no alt text without an image', () => {
    for (const locale of LocaleMap.LOCALES) {
      const altKeys = Object.keys(copy.textsOf(locale)).filter(key => key.startsWith('mediaAlt.'));
      deepStrictEqual(altKeys.sort(), SEED_MEDIA_KEYS.map(key => `mediaAlt.${key}`).sort(), locale);
    }
  });

  it('keeps placeholder partners as drafts (their name is the same in every language)', () => {
    ok(catalog.partners().every(partner => !partner.published));
    strictEqual(catalog.partners().length, 3);
  });

  it('rates the reviews on the seeded star scale', () => {
    strictEqual(DEMO_SETTINGS.reviewRatingMax, 5);
    for (const review of catalog.reviews()) {
      ok(review.rating >= 1 && review.rating <= DEMO_SETTINGS.reviewRatingMax, review.id);
    }
  });

  it('has a source file for every seed image (backend/assets)', () => {
    const directory = SeedAssetsDirectory.locate();
    deepStrictEqual(
      SEED_MEDIA_KEYS.filter(key => !existsSync(join(directory, SEED_MEDIA_SOURCES[key]))),
      [],
    );
  });

  it('links the social placeholder over https', () => {
    for (const link of catalog.socialLinks()) {
      ok(link.url.startsWith('https://'), link.url);
    }
  });

  it('gives every demo row a stable, distinct UUID', () => {
    const ids = [catalog.reviews(), catalog.gallery(), catalog.offers(), catalog.partners(), catalog.menu()]
      .flat()
      .map(row => row.id)
      .concat(catalog.socialLinks().map(link => link.id));
    strictEqual(new Set(ids).size, ids.length);
    deepStrictEqual(
      catalog.reviews().map(review => review.id),
      new DemoEntityCatalog(copy, new SeedRowIds()).reviews().map(review => review.id),
    );
  });
});

describe('seed menu', () => {
  const anchors = catalog.menu().map(item => item.href.replace(/^#/, ''));

  it("has the owner's six items: Главная, Каталог, О нас, Индивидуальный пошив, Специальное предложение, Контакты", () => {
    deepStrictEqual(anchors, ['home', 'catalog', 'about', 'tailoring', 'offers', 'contacts']);
    deepStrictEqual(
      catalog.menu().map(item => item.label[Locale.RU]),
      ['Главная', 'Каталог', 'О нас', 'Индивидуальный пошив', 'Специальное предложение', 'Контакты'],
    );
  });

  it('follows the order of the sections on the page (= the namespaces of shared/messages/ru.json)', () => {
    // The cover's anchor is "home"; every other anchor is its section's namespace.
    const sectionOf = (anchor: string): string => (anchor === 'home' ? 'hero' : anchor);
    const namespaces = [...new Set(site.siteKeys().map(key => key.slice(0, key.indexOf('.'))))];
    const positions = anchors.map(anchor => namespaces.indexOf(sectionOf(anchor)));
    ok(
      positions.every(position => position >= 0),
      String(positions),
    );
    deepStrictEqual(
      [...positions].sort((left, right) => left - right),
      positions,
    );
    strictEqual(DEMO_MENU.length, 6);
  });
});
