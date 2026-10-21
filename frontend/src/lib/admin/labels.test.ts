import { describe, expect, it } from 'vitest';

import { adminTestTranslator } from '../../../test/admin-intl';
import { actionFail, errorFor } from './action-result';
import { fileSizeParts, formatStars } from './labels';
import { slugify } from './slug';

/** The admin's own client-side helpers (the backend validates what is saved). */

describe('slugify', () => {
  it('transliterates Russian titles', () => {
    expect(slugify('Меня запомнят')).toBe('menya-zapomnyat');
    expect(slugify('Худи «Знак», белое')).toBe('hudi-znak-beloe');
    expect(slugify('  Поп-ап в Краснодаре — 2026!  ')).toBe('pop-ap-v-krasnodare-2026');
    expect(slugify('Ёжик щёки')).toBe('ezhik-scheki');
  });
});

describe('errorFor', () => {
  it('finds the error of a field or of one of its translations', () => {
    const failure = actionFail('Проверьте поля формы', { slug: 'Укажите адрес', 'title.ru': 'Заполните текст' });
    expect(errorFor(failure.fieldErrors, 'slug')).toBe('Укажите адрес');
    expect(errorFor(failure.fieldErrors, 'title')).toBe('Заполните текст');
    expect(errorFor(failure.fieldErrors, 'price')).toBeUndefined();
    expect(errorFor(undefined, 'slug')).toBeUndefined();
  });
});

describe('formatStars', () => {
  it('draws the rating on the current scale', () => {
    expect(formatStars(4, 5)).toBe('★★★★☆');
    expect(formatStars(3, 10)).toBe('★★★☆☆☆☆☆☆☆');
    expect(formatStars(7, 5)).toBe('★★★★★');
  });
});

describe('admin plurals and sizes (ICU messages)', () => {
  it('pluralizes Russian counts', () => {
    const t = adminTestTranslator('admin.common');
    expect(t('products', { count: 1 })).toBe('1 товар');
    expect(t('products', { count: 3 })).toBe('3 товара');
    expect(t('products', { count: 11 })).toBe('11 товаров');
    expect(t('products', { count: 22 })).toBe('22 товара');
    const v = adminTestTranslator('admin.validation');
    expect(v('tooLong', { max: 1 })).toBe('Не длиннее 1 символа');
    expect(v('tooLong', { max: 120 })).toBe('Не длиннее 120 символов');
  });

  it('formats file sizes', () => {
    const t = adminTestTranslator('admin.media');
    expect(t('fileSize', fileSizeParts(512))).toBe('512 Б');
    expect(t('fileSize', fileSizeParts(820 * 1024))).toBe('820 КБ');
    expect(t('fileSize', fileSizeParts(1.44 * 1024 * 1024))).toBe('1,4 МБ');
  });
});
