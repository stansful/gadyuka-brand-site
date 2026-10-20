import { describe, expect, it } from 'vitest';

import type { Locale } from '@/i18n/locales';
import type { AdminMediaRef } from '@/lib/admin/types';

import {
  editImage,
  editText,
  hasUnsavedText,
  imageChanges,
  settleImages,
  settleTexts,
  shownImage,
  shownText,
  textChanges,
  type TextDrafts,
} from './site-text-drafts';

type Entry = { key: string; values: Record<Locale, string>; missing: Locale[] };

function entry(key: string, ru: string, en: string, missing: Locale[] = []): Entry {
  return { key, values: { ru, en }, missing };
}

/** The page's texts of `entries` (what a save settles against). */
function page(...entries: Entry[]): Record<string, Record<Locale, string>> {
  return Object.fromEntries(entries.map(item => [item.key, item.values]));
}

const title = entry('hero.title', 'ГАДЮКА', 'GADYUKA');
const slogan = entry('hero.slogan', 'Меня запомнят', 'They will remember me');

describe('texts: what a save sends', () => {
  it('sends only the edited languages, each with the stored text it started from', () => {
    const drafts = editText({}, slogan, { ...slogan.values, ru: 'Новый слоган' });
    expect(textChanges(drafts, [title, slogan])).toEqual([
      { key: 'hero.slogan', values: { ru: { value: 'Новый слоган', base: 'Меня запомнят' } } },
    ]);
  });

  it('never resends an untouched text of a stale tab (the lost-update scenario)', () => {
    // Tab 1 loaded the default title; tab 2 changed it to «ГАДЮКА 2.0» meanwhile. Tab 1 edits the
    // slogan only: the stale title must not be part of its save.
    const drafts = editText({}, slogan, { ...slogan.values, ru: 'Новый слоган' });
    const sent = textChanges(drafts, [title, slogan]);
    expect(sent.map(item => item.key)).toEqual(['hero.slogan']);
    // And an edit of the stale title carries the version tab 1 saw, so the server can refuse it.
    const both = editText(drafts, title, { ...title.values, ru: 'Моя правка' });
    expect(textChanges(both, [title, slogan])[0]).toEqual({
      key: 'hero.title',
      values: { ru: { value: 'Моя правка', base: 'ГАДЮКА' } },
    });
  });

  it('resends the languages without a row (the save creates them), as unchanged', () => {
    expect(textChanges({}, [entry('hero.sfx', 'ШШШ', 'HSSS', ['en'])])).toEqual([
      { key: 'hero.sfx', values: { en: { value: 'HSSS', base: 'HSSS' } } },
    ]);
  });

  it('forgets an edit typed back to the stored text', () => {
    const typed = editText({}, slogan, { ...slogan.values, ru: 'Новый' });
    const back = editText(typed, slogan, slogan.values);
    expect(textChanges(back, [slogan])).toEqual([]);
    expect(hasUnsavedText(back, slogan)).toBe(false);
  });
});

describe('texts: after a save', () => {
  it('shows what was stored (trimmed) and holds no edit', () => {
    const drafts = editText({}, slogan, { ...slogan.values, ru: ' Новый слоган ' });
    const sent = textChanges(drafts, [slogan]);
    const settled = settleTexts(drafts, sent, { 'hero.slogan': { ru: 'Новый слоган' } }, page(slogan));
    // Before the page re-renders with the new text…
    expect(shownText(settled, slogan).ru).toBe('Новый слоган');
    expect(hasUnsavedText(settled, slogan)).toBe(false);
    expect(textChanges(settled, [slogan])).toEqual([]);
    // …and after.
    const fresh = entry('hero.slogan', 'Новый слоган', slogan.values.en);
    expect(shownText(settled, fresh).ru).toBe('Новый слоган');
    expect(textChanges(settled, [fresh])).toEqual([]);
  });

  it('keeps text typed while the save was running, as an edit of the stored text', () => {
    const drafts = editText({}, slogan, { ...slogan.values, ru: 'Новый слоган' });
    const sent = textChanges(drafts, [slogan]);
    // The owner keeps typing before the action answers.
    const typing = editText(drafts, slogan, { ...slogan.values, ru: 'Новый слоган — осень' });
    const settled = settleTexts(typing, sent, { 'hero.slogan': { ru: 'Новый слоган' } }, page(slogan));
    expect(shownText(settled, slogan).ru).toBe('Новый слоган — осень');
    const fresh = entry('hero.slogan', 'Новый слоган', slogan.values.en);
    expect(hasUnsavedText(settled, fresh)).toBe(true);
    expect(textChanges(settled, [fresh])).toEqual([
      { key: 'hero.slogan', values: { ru: { value: 'Новый слоган — осень', base: 'Новый слоган' } } },
    ]);
  });

  it('settles the same way when the page re-renders before the action answers', () => {
    const drafts = editText({}, slogan, { ...slogan.values, ru: 'Новый слоган' });
    const sent = textChanges(drafts, [slogan]);
    const fresh = entry('hero.slogan', 'Новый слоган', slogan.values.en);
    expect(shownText(drafts, fresh).ru).toBe('Новый слоган');
    const settled = settleTexts(drafts, sent, { 'hero.slogan': { ru: 'Новый слоган' } }, page(slogan));
    expect(shownText(settled, fresh).ru).toBe('Новый слоган');
    expect(textChanges(settled, [fresh])).toEqual([]);
  });

  it('follows a newer text of the page once the save is done (another tab)', () => {
    const drafts = editText({}, slogan, { ...slogan.values, ru: 'Новый слоган' });
    const settled = settleTexts(
      drafts,
      textChanges(drafts, [slogan]),
      { 'hero.slogan': { ru: 'Новый слоган' } },
      page(slogan),
    );
    const newer = entry('hero.slogan', 'Слоган из другой вкладки', slogan.values.en);
    expect(shownText(settled, newer).ru).toBe('Слоган из другой вкладки');
    expect(textChanges(settled, [newer])).toEqual([]);
  });
});

describe('texts: the page re-renders with other entries (search mode)', () => {
  it('shows a text that starts matching with its stored values and does not send it', () => {
    const drafts: TextDrafts = editText({}, slogan, { ...slogan.values, ru: 'Новый слоган' });
    const soon = entry('catalog.soon', 'Скоро доставка', 'Delivery soon');
    expect(shownText(drafts, soon)).toEqual(soon.values);
    expect(hasUnsavedText(drafts, soon)).toBe(false);
    expect(textChanges(drafts, [slogan, soon]).map(item => item.key)).toEqual(['hero.slogan']);
  });

  it('shows an untouched text with its newer stored value', () => {
    const newer = entry('hero.title', 'ГАДЮКА 2.0', 'GADYUKA');
    expect(shownText({}, newer).ru).toBe('ГАДЮКА 2.0');
  });
});

describe('texts: «Вернуть по умолчанию»', () => {
  it('shows the defaults once the reset is stored', () => {
    const edited = entry('hero.slogan', 'Правка', 'Edit');
    const drafts = editText({}, edited, { ...edited.values, ru: 'Ещё правка' });
    const shown = shownText(drafts, edited);
    const sent = [
      { key: edited.key, values: { ru: { value: shown.ru, base: shown.ru }, en: { value: shown.en, base: shown.en } } },
    ];
    const settled = settleTexts(drafts, sent, { [edited.key]: slogan.values }, page(edited));
    expect(shownText(settled, edited)).toEqual(slogan.values);
    expect(shownText(settled, slogan)).toEqual(slogan.values);
    expect(textChanges(settled, [slogan])).toEqual([]);
  });
});

describe('landing images', () => {
  const m1: AdminMediaRef = { id: 'm1', url: '/media/1.webp', width: 10, height: 10, alt: {} };
  const m2: AdminMediaRef = { id: 'm2', url: '/media/2.webp', width: 10, height: 10, alt: {} };
  const m3: AdminMediaRef = { id: 'm3', url: '/media/3.webp', width: 10, height: 10, alt: {} };
  const about = { key: 'about.image', media: m1 };
  const tailoring = { key: 'tailoring.image', media: null };

  it('sends only a picked image, with the stored one it replaces', () => {
    const drafts = editImage({}, about, m2);
    expect(shownImage(drafts, about)).toBe(m2);
    expect(imageChanges(drafts, [about, tailoring])).toEqual([{ key: 'about.image', media: m2, base: m1 }]);
    expect(imageChanges(editImage(drafts, about, m1), [about])).toEqual([]);
  });

  it('settles on the saved image and then follows the page', () => {
    const drafts = editImage({}, about, m2);
    const settled = settleImages(drafts, imageChanges(drafts, [about]), { 'about.image': m1 });
    expect(shownImage(settled, about)).toBe(m2);
    expect(imageChanges(settled, [about])).toEqual([]);
    expect(shownImage(settled, { key: 'about.image', media: m3 })).toBe(m3);
  });

  it('keeps an image picked while the save was running', () => {
    const drafts = editImage({}, about, m2);
    const sent = imageChanges(drafts, [about]);
    const settled = settleImages(editImage(drafts, about, m3), sent, { 'about.image': m1 });
    expect(shownImage(settled, { key: 'about.image', media: m2 })).toBe(m3);
    expect(imageChanges(settled, [{ key: 'about.image', media: m2 }])).toEqual([
      { key: 'about.image', media: m3, base: m2 },
    ]);
  });
});
