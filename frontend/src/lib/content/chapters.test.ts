import { describe, expect, it } from 'vitest';

import en from '@shared/messages/en.json';
import ru from '@shared/messages/ru.json';

import { sectionMessageKeys, SITE_TEXT_SECTIONS } from '../../../test/site-text-metadata';
import { SECTION_ANCHORS } from './anchors';
import { CHAPTER_ORDER, chapterNumber } from './registry';

/**
 * The landing's chapters and comic copy (the demo content itself is tested by the backend seed,
 * backend/src/cli/seed).
 */
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
    const listed = SITE_TEXT_SECTIONS.filter(id => CHAPTER_ORDER.some(chapter => chapter === id));
    expect(listed).toEqual([...CHAPTER_ORDER]);
  });

  it('are all anchored sections with copy in the admin', () => {
    for (const id of CHAPTER_ORDER) {
      expect(SECTION_ANCHORS[id]).toBe(id);
      expect(sectionMessageKeys(id).length).toBeGreaterThan(0);
    }
  });

  it('follow the order of the namespaces in shared/messages/ru.json (the backend seed orders its menu by it)', () => {
    const namespaces = Object.keys(ru);
    const pagePositions = ['hero', ...CHAPTER_ORDER].map(section => namespaces.indexOf(section));
    expect(pagePositions.every(position => position >= 0)).toBe(true);
    expect([...pagePositions].sort((left, right) => left - right)).toEqual(pagePositions);
  });
});

describe('comic copy', () => {
  it('translates the comic SFX', () => {
    expect(en.hero.sfx).toMatch(/^HS+/);
    expect(en.about.sfx).toBe('SHHH!');
    expect(en.tailoring.sfx).toBe('SNIP!');
  });
});
