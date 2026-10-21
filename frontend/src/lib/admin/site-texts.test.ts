import { describe, expect, it } from 'vitest';

import type { SiteTextEntry, SiteTextsPageResponse } from '@shared/contracts/site-texts';

import { adminTestTranslator } from '../../../test/admin-intl';
import { siteTextLabels, siteTextSectionAnchor, toSiteTextsPageData } from './site-texts';

/**
 * The admin side of «Тексты сайта» on the frontend: names and anchors. The rules of the texts (kinds,
 * required texts, ICU checks, search, conflicts) live in the backend and are tested there
 * (backend/src/usecases/admin/site-texts).
 */

const labels = siteTextLabels(adminTestTranslator('admin.siteTexts'));

function entry(key: string, value: string): SiteTextEntry {
  return {
    key,
    kind: 'text',
    required: false,
    values: { ru: value, en: value },
    defaults: { ru: value, en: value },
    edited: {},
    missing: [],
    placeholders: [],
    tags: [],
  };
}

describe('labels', () => {
  it('names sections, texts and images from admin.siteTexts (key fallback for unlabeled texts)', () => {
    expect(labels.section('about')).toBe('О нас');
    expect(labels.section('zzzNew')).toBe('zzzNew');
    expect(labels.text('about.advantages.0.title')).toBe('Преимущество 1: заголовок');
    // ICU-escaped in the JSON: the label shows the placeholder literally.
    expect(labels.text('catalog.collectionTitle')).toBe('Название коллекции в кавычках ({title} — название)');
    expect(labels.text('zzzNew.some.key')).toBe('some.key');
    expect(labels.image('about.image')).toBe('Фото');
    expect(labels.image('zzz.image')).toBe('zzz.image');
  });

  it('knows the landing anchor of a section', () => {
    expect(siteTextSectionAnchor('hero')).toBe('home');
    expect(siteTextSectionAnchor('forms')).toBeNull();
    expect(siteTextSectionAnchor('toString')).toBeNull();
  });
});

describe('toSiteTextsPageData', () => {
  it('adds the admin names and the landing anchors to the backend page', () => {
    const page: SiteTextsPageResponse = {
      sections: [
        { id: 'hero', total: 2, edited: 1, gaps: 0, unsaved: 0 },
        { id: 'about', total: 1, edited: 0, gaps: 1, unsaved: 1 },
      ],
      mode: 'section',
      section: 'about',
      query: '',
      groups: [
        {
          section: 'about',
          entries: [entry('about.advantages.0.title', 'Авторские модели')],
          images: [{ key: 'about.image', media: null }],
        },
      ],
    };
    expect(toSiteTextsPageData(page, labels)).toEqual({
      sections: [
        { id: 'hero', label: labels.section('hero'), total: 2, edited: 1, gaps: 0, unsaved: 0 },
        { id: 'about', label: 'О нас', total: 1, edited: 0, gaps: 1, unsaved: 1 },
      ],
      mode: 'section',
      section: 'about',
      query: '',
      groups: [
        {
          section: 'about',
          label: 'О нас',
          anchor: 'about',
          entries: [{ ...entry('about.advantages.0.title', 'Авторские модели'), label: 'Преимущество 1: заголовок' }],
          images: [{ key: 'about.image', media: null, label: 'Фото' }],
        },
      ],
    });
  });
});
