import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import contentEn from '../../messages/content/en.json';
import contentRu from '../../messages/content/ru.json';
import en from '../../messages/en.json';
import ru from '../../messages/ru.json';
import { locales } from '../../src/i18n/locales';
import { flattenMessages } from '../../src/i18n/messages';
import { SECTION_ANCHORS } from '../../src/lib/content/anchors';
import { CHAPTER_ORDER, chapterNumber, CONTENT_SECTIONS, sectionMessageKeys } from '../../src/lib/content/registry';
import { SEED_COPY } from './copy';
import {
  SEED_COLLECTION,
  SEED_GALLERY,
  SEED_MENU,
  SEED_NEWS,
  SEED_OFFERS,
  SEED_PARTNERS,
  SEED_PRODUCTS,
  SEED_REVIEWS,
  SEED_SETTINGS,
  SEED_SOCIALS,
} from './entities';
import { SEED_MEDIA, SEED_MEDIA_KEYS, seedMediaAlt } from './media';

/**
 * Owner rule: the collection «Меня запомнят» is never described as first / debut / №1 —
 * in any language. Product numbers (#01…#04) are fine: they number products, not issues.
 */
const FORBIDDEN = [/перв/i, /дебют/i, /\bfirst\b/i, /\bdebut/i, /№\s*0*1\b/, /\bno\.?\s*0*1\b/i, /issue\s*#?\s*0*1\b/i];

const ROOT = path.resolve(import.meta.dirname, '../..');

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('seed copy', () => {
  it('never calls the collection first / debut / №1', () => {
    const all = strings([
      ru,
      en,
      contentRu,
      contentEn,
      SEED_COLLECTION,
      SEED_PRODUCTS,
      SEED_REVIEWS,
      SEED_NEWS,
      SEED_GALLERY,
      SEED_OFFERS,
      SEED_PARTNERS,
      SEED_MENU,
      SEED_SETTINGS,
    ]);
    const offending = all.filter(text => FORBIDDEN.some(pattern => pattern.test(text)));
    expect(offending).toEqual([]);
  });

  it('has the same, non-empty entity copy in every locale (messages/content/*.json)', () => {
    const reference = Object.keys(flattenMessages(SEED_COPY.ru)).sort();
    for (const locale of locales) {
      const flat = flattenMessages(SEED_COPY[locale]);
      expect(Object.keys(flat).sort(), locale).toEqual(reference);
      expect(
        Object.entries(flat).filter(([, text]) => text.trim() === ''),
        locale,
      ).toEqual([]);
    }
  });

  it('resolves every localized seed field for every locale', () => {
    const fields = [
      SEED_COLLECTION.title,
      ...SEED_PRODUCTS.flatMap(product => [product.title, product.description, product.details]),
      ...SEED_REVIEWS.flatMap(review => [review.role, review.text]),
      ...SEED_NEWS.flatMap(item => [item.title, item.excerpt, item.body]),
      ...SEED_MENU.map(item => item.label),
      ...SEED_MEDIA_KEYS.map(seedMediaAlt),
    ];
    for (const field of fields) expect(Object.keys(field)).toEqual([...locales]);
    expect(SEED_REVIEWS.map(review => review.author)).toEqual(['Сергей', 'Анна', 'Дмитрий']);
  });

  it('keeps placeholder partners as drafts (their name is the same in every language)', () => {
    expect(SEED_PARTNERS.every(partner => !partner.published)).toBe(true);
  });

  it('translates the comic SFX', () => {
    expect(en.hero.sfx).toMatch(/^HS+/);
    expect(en.about.sfx).toBe('SHHH!');
    expect(en.tailoring.sfx).toBe('SNIP!');
  });

  it('rates the reviews on the seeded star scale', () => {
    expect(SEED_SETTINGS.reviewRatingMax).toBe(5);
    for (const review of SEED_REVIEWS) {
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(SEED_SETTINGS.reviewRatingMax);
    }
  });

  it('has a source file for every seed image', () => {
    const missing = Object.values(SEED_MEDIA).filter(media => !existsSync(path.join(ROOT, media.source)));
    expect(missing).toEqual([]);
  });

  it('links the social placeholder over https', () => {
    for (const link of SEED_SOCIALS) expect(link.url).toMatch(/^https:\/\//);
  });
});

/** Page position of an anchor: the cover first, then the chapters in CHAPTER_ORDER. */
function pagePosition(anchor: string): number {
  if (anchor === SECTION_ANCHORS.hero) return 0;
  const index = CHAPTER_ORDER.findIndex(id => SECTION_ANCHORS[id] === anchor);
  return index < 0 ? -1 : index + 1;
}

describe('seed menu', () => {
  const anchors = SEED_MENU.map(item => item.href.replace(/^#/, ''));

  it("has the owner's six items: Главная, Каталог, О нас, Индивидуальный пошив, Специальное предложение, Контакты", () => {
    expect(anchors).toEqual(['home', 'catalog', 'about', 'tailoring', 'offers', 'contacts']);
    expect(SEED_MENU.map(item => item.label.ru)).toEqual([
      'Главная',
      'Каталог',
      'О нас',
      'Индивидуальный пошив',
      'Специальное предложение',
      'Контакты',
    ]);
    expect(SEED_MENU.every(item => item.showInHeader && item.showInFooter)).toBe(true);
  });

  it('follows the order of the sections on the page', () => {
    const positions = anchors.map(pagePosition);
    expect(positions.every(position => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe('chapters', () => {
  it("follow the owner's order: Каталог → О нас → Пошив → Спецпредложения → Новости → Галерея → Отзывы → Партнёры → Контакты", () => {
    expect(CHAPTER_ORDER).toEqual([
      'catalog',
      'about',
      'tailoring',
      'offers',
      'news',
      'gallery',
      'reviews',
      'partners',
      'contacts',
    ]);
    expect(chapterNumber('about')).toBe('02');
    expect(chapterNumber('tailoring')).toBe('03');
    expect(chapterNumber('offers')).toBe('04');
    expect(chapterNumber('reviews')).toBe('07');
    expect(chapterNumber('contacts')).toBe('09');
  });

  it('are listed in the admin «Контент» in the same order', () => {
    const listed = CONTENT_SECTIONS.map(section => section.id).filter(id =>
      CHAPTER_ORDER.some(chapter => chapter === id),
    );
    expect(listed).toEqual([...CHAPTER_ORDER]);
  });

  it('are all anchored sections with copy in the admin', () => {
    for (const id of CHAPTER_ORDER) {
      expect(SECTION_ANCHORS[id]).toBe(id);
      expect(sectionMessageKeys(id).length).toBeGreaterThan(0);
    }
  });
});
