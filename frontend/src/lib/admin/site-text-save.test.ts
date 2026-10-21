import { describe, expect, it } from 'vitest';

import { adminTestTranslator } from '../../../test/admin-intl';
import { parseSiteTextConflicts, siteTextConflictFailure } from './site-text-save';
import { siteTextLabels } from './site-texts';

const labels = siteTextLabels(adminTestTranslator('admin.siteTexts'));
const tErrors = adminTestTranslator('admin.siteTexts.errors');

const TITLE = 'hero.title';
const SLOGAN = 'hero.slogan';

describe('parseSiteTextConflicts (details of the backend 409)', () => {
  it('reads "<key>.<locale>" → the stored text and "<image key>" → true, in order', () => {
    expect(
      parseSiteTextConflicts({
        [`${TITLE}.ru`]: 'ГАДЮКА 2.0',
        [`${SLOGAN}.en`]: '',
        'about.image': true,
        'hero.title.de': 'unknown locale',
        odd: 3,
      }),
    ).toEqual({
      texts: [
        { key: TITLE, locale: 'ru', current: 'ГАДЮКА 2.0' },
        { key: SLOGAN, locale: 'en', current: '' },
      ],
      images: ['about.image'],
    });
    expect(parseSiteTextConflicts(undefined)).toEqual({ texts: [], images: [] });
  });
});

describe('siteTextConflictFailure', () => {
  it('names the texts and images changed elsewhere and asks to reload; fields quote what is stored', () => {
    const failure = siteTextConflictFailure(
      {
        texts: [
          { key: TITLE, locale: 'ru', current: 'ГАДЮКА 2.0' },
          { key: SLOGAN, locale: 'en', current: '' },
        ],
        images: ['about.image'],
      },
      labels,
      tErrors,
    );
    expect(failure.message).toContain(`«${labels.text(TITLE)}» (RU), «${labels.text(SLOGAN)}» (EN), картинку «Фото»`);
    expect(failure.message).toMatch(/^Ничего не сохранено/);
    expect(failure.message).toMatch(/обновите страницу/);
    expect(failure.fieldErrors).toEqual({
      [`${TITLE}.ru`]: expect.stringContaining('Сейчас сохранено: «ГАДЮКА 2.0»'),
      [`${SLOGAN}.en`]: expect.stringContaining('сейчас он пустой'),
      'about.image': expect.stringContaining('обновите страницу'),
    });
  });

  it('counts the texts beyond the first five and quotes at most 140 characters', () => {
    const texts = Array.from({ length: 7 }, (_, index) => ({
      key: `hero.text${index}`,
      locale: 'ru' as const,
      current: 'x'.repeat(200),
    }));
    const failure = siteTextConflictFailure({ texts, images: [] }, labels, tErrors);
    expect(failure.message).toContain('и ещё 2.');
    expect(failure.fieldErrors['hero.text0.ru']).toContain(`«${'x'.repeat(140)}…»`);
  });
});
