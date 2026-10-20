import { describe, expect, it, vi } from 'vitest';

import { adminTestTranslator } from '../../../test/admin-intl';
import { errorFor } from './action-result';
import { fileSizeParts, formatStars } from './labels';
import {
  endOfDayFromInput,
  menuItemInputSchema,
  newsDateFromInput,
  offerInputSchema,
  partnerInputSchema,
  PRICE_MAX,
  productInputSchema,
  reorderInputSchema,
  reviewInputSchema,
  settingsInputSchema,
  siteTextsInputSchema,
  slugSchema,
  socialLinkInputSchema,
  toDateInputValue,
} from './schemas';
import { slugify } from './slug';
import { parseInput } from './validation';

// parseInput translates the admin.validation keys with next-intl (no request scope in tests).
vi.mock('next-intl/server', async () => (await import('../../../test/admin-intl')).nextIntlServerMock);

const baseProduct = {
  slug: 'hoodie',
  collectionId: 'c1',
  title: { ru: 'Худи' },
  description: {},
  details: {},
  price: 12900,
  imageIds: ['m1', 'm2'],
  published: true,
};

describe('slugs', () => {
  it('transliterates Russian titles', () => {
    expect(slugify('Меня запомнят')).toBe('menya-zapomnyat');
    expect(slugify('Худи «Знак», белое')).toBe('hudi-znak-beloe');
    expect(slugify('  Поп-ап в Краснодаре — 2026!  ')).toBe('pop-ap-v-krasnodare-2026');
    expect(slugify('Ёжик щёки')).toBe('ezhik-scheki');
  });

  it('validates slugs', () => {
    expect(slugSchema.parse(' Menya-Zapomnyat ')).toBe('menya-zapomnyat');
    expect(slugSchema.safeParse('два слова').success).toBe(false);
    expect(slugSchema.safeParse('-edge-').success).toBe(false);
    expect(slugSchema.safeParse('a--b').success).toBe(false);
  });
});

describe('entity schemas', () => {
  it('requires the Russian title and drops empty translations', async () => {
    const ok = await parseInput(productInputSchema, { ...baseProduct, title: { ru: ' Худи ', en: '' } });
    expect(ok.success && ok.data.title).toEqual({ ru: 'Худи' });

    const missingRu = await parseInput(productInputSchema, { ...baseProduct, title: { en: 'Hoodie' } });
    expect(missingRu.success).toBe(false);
    if (!missingRu.success) {
      expect(errorFor(missingRu.fieldErrors, 'title')).toBe('Заполните текст на языке по умолчанию (ru)');
      expect(missingRu.message).toBe('Проверьте поля формы — есть ошибки');
    }
  });

  it('translates admin.validation keys, generic limits and leaves zod texts as they are', async () => {
    const slug = await parseInput(productInputSchema, { ...baseProduct, slug: 'a'.repeat(121) });
    expect(!slug.success && slug.fieldErrors.slug).toBe('Не длиннее 120 символов');
    const format = await parseInput(productInputSchema, { ...baseProduct, slug: 'два слова' });
    expect(!format.success && format.fieldErrors.slug).toBe(
      'Только латиница, цифры и дефисы, например: menya-zapomnyat',
    );
    const photos = await parseInput(productInputSchema, {
      ...baseProduct,
      imageIds: Array.from({ length: 31 }, (_, index) => `m${index}`),
    });
    expect(!photos.success && photos.fieldErrors.imageIds).toBe('Не больше 30 фото');
    const rating = await parseInput(reviewInputSchema, {
      author: 'Анна',
      role: {},
      text: { ru: 'Отлично' },
      avatarId: null,
      rating: 11,
      published: true,
    });
    expect(!rating.success && rating.fieldErrors.rating).toBe('Оценка не может быть больше 10');
  });

  it('reports per-locale length errors as <field>.<locale>', async () => {
    const result = await parseInput(productInputSchema, { ...baseProduct, title: { ru: 'Худи', en: 'x'.repeat(201) } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors['title.en']).toBe('Не длиннее 200 символов');
  });

  it('validates prices and image lists', async () => {
    expect((await parseInput(productInputSchema, { ...baseProduct, price: null })).success).toBe(true);
    expect((await parseInput(productInputSchema, { ...baseProduct, price: PRICE_MAX })).success).toBe(true);
    expect((await parseInput(productInputSchema, { ...baseProduct, price: -1 })).success).toBe(false);
    expect((await parseInput(productInputSchema, { ...baseProduct, price: 10.5 })).success).toBe(false);
    expect((await parseInput(productInputSchema, { ...baseProduct, imageIds: ['m1', 'm1'] })).success).toBe(false);
  });

  it('explains each price error with its own message (an integer over the limit is not «не целое»)', async () => {
    const priceError = async (price: number): Promise<string | undefined> => {
      const result = await parseInput(productInputSchema, { ...baseProduct, price });
      return result.success ? undefined : result.fieldErrors.price;
    };
    // An extra zero, and numbers past the safe integer range (they fail .int() too).
    for (const price of [PRICE_MAX + 1, 200_000_000, 2 ** 53, 1e20]) {
      expect(await priceError(price)).toMatch(/^Цена не больше 100\s000\s000 ₽/);
    }
    expect(await priceError(-1)).toBe('Цена не может быть отрицательной');
    expect(await priceError(10.5)).toBe('Цена — целое число рублей');
    expect(await priceError(Number.POSITIVE_INFINITY)).toBe('Цена — целое число рублей');
  });

  it('gives length checks chained to z.url / z.email their own message', async () => {
    const partner = { name: 'Бренд', logoId: null, description: {}, published: true };
    const url = await parseInput(partnerInputSchema, { ...partner, url: `https://example.ru/${'a'.repeat(500)}` });
    expect(!url.success && url.fieldErrors.url).toBe('Не длиннее 500 символов');
    const settings = {
      phone: '',
      address: {},
      reviewRatingMax: 5,
      seoTitle: {},
      seoDescription: {},
      ogImageId: null,
    };
    const email = await parseInput(settingsInputSchema, { ...settings, email: `${'a'.repeat(200)}@example.ru` });
    expect(!email.success && email.fieldErrors.email).toBe('Не длиннее 200 символов');
  });

  it('rejects unknown locales and javascript: links', async () => {
    expect(
      (await parseInput(productInputSchema, { ...baseProduct, title: { ru: 'Худи', de: 'Hoodie' } })).success,
    ).toBe(false);
    const offer = {
      title: { ru: 'Скидка' },
      text: {},
      badge: {},
      ctaLabel: { ru: 'Купить' },
      validUntil: null,
      imageId: null,
      published: true,
    };
    expect((await parseInput(offerInputSchema, { ...offer, ctaHref: 'javascript:alert(1)' })).success).toBe(false);
    expect((await parseInput(offerInputSchema, { ...offer, ctaHref: '//evil.example' })).success).toBe(false);
    for (const href of [
      '#contacts',
      '/en#tailoring',
      'https://t.me/gadyuka',
      'mailto:hi@example.ru',
      'tel:+79000000000',
    ]) {
      expect((await parseInput(offerInputSchema, { ...offer, ctaHref: href })).success).toBe(true);
    }
  });

  it('validates settings with messages from admin.validation', async () => {
    const base = {
      phone: '+7 (900) 000-00-00',
      email: '',
      address: {},
      reviewRatingMax: 5,
      seoTitle: {},
      seoDescription: {},
      ogImageId: null,
    };
    expect((await parseInput(settingsInputSchema, base)).success).toBe(true);
    const bad = await parseInput(settingsInputSchema, { ...base, email: 'nope', reviewRatingMax: 11 });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.fieldErrors.email).toBe('Некорректный e-mail');
      expect(bad.fieldErrors.reviewRatingMax).toBe('От 1 до 10 звёзд');
    }
    expect((await parseInput(settingsInputSchema, { ...base, reviewRatingMax: 0 })).success).toBe(false);
    expect((await parseInput(settingsInputSchema, { ...base, reviewRatingMax: 2.5 })).success).toBe(false);
  });

  it('bounds review ratings by the hard 1..10 limit (the current scale is checked by the action)', async () => {
    const review = { author: 'Анна', role: {}, text: { ru: 'Отлично' }, avatarId: null, published: true };
    for (const rating of [null, 1, 7, 10]) {
      expect((await parseInput(reviewInputSchema, { ...review, rating })).success).toBe(true);
    }
    for (const rating of [0, 11, 3.5]) {
      expect((await parseInput(reviewInputSchema, { ...review, rating })).success).toBe(false);
    }
  });

  it('validates menu items: Russian label and a site link', async () => {
    const item = {
      label: { ru: 'Каталог' },
      href: '#catalog',
      showInHeader: true,
      showInFooter: false,
      published: true,
    };
    for (const href of ['#catalog', '/catalog/menya-zapomnyat', 'https://t.me/gadyuka', 'mailto:a@b.ru', 'tel:+7900']) {
      expect((await parseInput(menuItemInputSchema, { ...item, href })).success).toBe(true);
    }
    const empty = await parseInput(menuItemInputSchema, { ...item, href: ' ' });
    expect(!empty.success && empty.fieldErrors.href).toBe('Укажите ссылку');
    const bare = await parseInput(menuItemInputSchema, { ...item, href: '#' });
    expect(!bare.success && bare.fieldErrors.href).toMatch(/#catalog/);
    for (const href of ['javascript:alert(1)', '//evil.example', 'catalog']) {
      expect((await parseInput(menuItemInputSchema, { ...item, href })).success).toBe(false);
    }
    const noLabel = await parseInput(menuItemInputSchema, { ...item, label: { en: 'Catalog' } });
    expect(!noLabel.success && errorFor(noLabel.fieldErrors, 'label')).toMatch(/ru/);
  });

  it('validates social links: enum type, http(s) url, optional label', async () => {
    const link = { type: 'TELEGRAM', url: 'https://t.me/gadyuka', label: {}, published: true };
    expect((await parseInput(socialLinkInputSchema, link)).success).toBe(true);
    expect((await parseInput(socialLinkInputSchema, { ...link, label: { ru: 'Наш канал', en: '' } })).success).toBe(
      true,
    );
    expect((await parseInput(socialLinkInputSchema, { ...link, type: 'telegram' })).success).toBe(false);
    const ftp = await parseInput(socialLinkInputSchema, { ...link, url: 'ftp://x' });
    expect(!ftp.success && ftp.fieldErrors.url).toMatch(/https/);
  });

  it('validates the site texts payload: known locales, trimmed values kept even when empty, base as stored', async () => {
    const ok = await parseInput(siteTextsInputSchema, {
      entries: [
        {
          key: 'hero.title',
          values: { ru: { value: ' ГАДЮКА ', base: ' Старое ' }, en: { value: '', base: 'GADYUKA' } },
        },
      ],
      images: [{ key: 'about.image', mediaId: null, base: 'm1' }],
    });
    expect(ok.success && ok.data.entries[0]?.values).toEqual({
      ru: { value: 'ГАДЮКА', base: ' Старое ' },
      en: { value: '', base: 'GADYUKA' },
    });
    const unknownLocale = await parseInput(siteTextsInputSchema, {
      entries: [{ key: 'a.b', values: { de: { value: 'x', base: '' } } }],
      images: [],
    });
    expect(unknownLocale.success).toBe(false);
    // An edit without the version it started from cannot be checked for conflicts.
    const noBase = await parseInput(siteTextsInputSchema, {
      entries: [{ key: 'a.b', values: { ru: { value: 'x' } } }],
      images: [],
    });
    expect(noBase.success).toBe(false);
    const imageNoBase = await parseInput(siteTextsInputSchema, {
      entries: [],
      images: [{ key: 'about.image', mediaId: 'm2' }],
    });
    expect(imageNoBase.success).toBe(false);
    const duplicate = await parseInput(siteTextsInputSchema, {
      entries: [
        { key: 'a.b', values: {} },
        { key: 'a.b', values: {} },
      ],
      images: [],
    });
    expect(!duplicate.success && duplicate.fieldErrors.entries).toBe('Тексты повторяются');
    const long = await parseInput(siteTextsInputSchema, {
      entries: [{ key: 'a.b', values: { en: { value: 'x'.repeat(10_001), base: '' } } }],
      images: [],
    });
    expect(!long.success && long.fieldErrors['entries.0.values.en.value']).toMatch(/^Не длиннее 10\s000 символов$/);
  });

  it('rejects duplicate ids in a reorder request', () => {
    expect(reorderInputSchema.safeParse({ entity: 'review', ids: ['a', 'b'] }).success).toBe(true);
    expect(reorderInputSchema.safeParse({ entity: 'review', ids: ['a', 'a'] }).success).toBe(false);
    expect(reorderInputSchema.safeParse({ entity: 'lead', ids: ['a'] }).success).toBe(false);
    expect(reorderInputSchema.safeParse({ entity: 'menuItem', ids: ['a', 'b'] }).success).toBe(true);
    expect(reorderInputSchema.safeParse({ entity: 'socialLink', ids: ['a'] }).success).toBe(true);
  });

  it('uses Russian default messages for generic zod errors', async () => {
    const result = await parseInput(productInputSchema, { ...baseProduct, published: 'yes' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.published).toMatch(/[А-Яа-я]/);
  });
});

describe('Moscow dates', () => {
  it('round-trips news and offer dates through <input type=date>', () => {
    expect(toDateInputValue(newsDateFromInput('2026-10-01'))).toBe('2026-10-01');
    const until = endOfDayFromInput('2026-10-31');
    expect(toDateInputValue(until)).toBe('2026-10-31');
    expect(until.toISOString()).toBe('2026-10-31T20:59:59.999Z');
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
