import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import { PRICE_MAX } from '~core/catalog/catalog.constants';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { SettingsUpdateDto } from '~usecases/admin/catalog/settings-update/put/settings-update.dto';

import { CollectionSaveDto } from '../collections/collection-save.dto';
import { ProductSaveDto } from '../products/product-save.dto';
import { ReviewSaveDto } from '../reviews/review-save.dto';
import { BodyValidation } from '../test/body-validation';

/**
 * The request bodies of the catalog forms through the app's validation pipe — the rules (and the
 * first message per field) of the old zod schemas (frontend src/lib/admin/schemas.ts + its tests).
 */
describe('catalog request bodies (validation like the old admin schemas)', () => {
  const collections = new BodyValidation(CollectionSaveDto);
  const products = new BodyValidation(ProductSaveDto);
  const reviews = new BodyValidation(ReviewSaveDto);
  const settings = new BodyValidation(SettingsUpdateDto);
  const [m1, m2] = [randomUUID(), randomUUID()];
  const baseProduct = {
    slug: 'hoodie',
    collectionId: randomUUID(),
    title: { ru: 'Худи' },
    description: {},
    details: {},
    price: 12900,
    imageIds: [m1, m2],
    published: true,
  };
  const baseReview = {
    author: 'Анна',
    role: {},
    text: { ru: 'Отлично' },
    avatarId: null,
    rating: null,
    published: true,
  };
  const baseSettings = {
    phone: '+7 (900) 000-00-00',
    email: '',
    address: {},
    reviewRatingMax: 5,
    seoTitle: {},
    seoDescription: {},
    ogImageId: null,
  };
  const baseCollection = { slug: 'menya-zapomnyat', title: { ru: 'Меня запомнят' }, description: {}, coverId: null };

  describe('slugs', () => {
    it('trims and lower-cases the slug', async () => {
      const body = await collections.accept({ ...baseCollection, slug: ' Menya-Zapomnyat ', published: true });
      strictEqual(body.slug, 'menya-zapomnyat');
    });

    it('refuses spaces, Cyrillic, edge and double hyphens with slugFormat', async () => {
      for (const slug of ['два слова', '-edge-', 'a--b', 'a_b']) {
        deepStrictEqual(await products.fieldsOf({ ...baseProduct, slug }), {
          slug: { key: 'admin.validation.slugFormat' },
        });
      }
    });

    it('asks for a slug before its format, and names the length limit', async () => {
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, slug: '  ' }), {
        slug: { key: 'admin.validation.slugRequired' },
      });
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, slug: 'a'.repeat(121) }), {
        slug: { key: 'admin.validation.tooLong', values: { max: 120 } },
      });
    });
  });

  describe('localized texts', () => {
    it('stores the translations trimmed, empty ones dropped', async () => {
      const body = await products.accept({ ...baseProduct, title: { ru: ' Худи ', en: '' } });
      deepStrictEqual(LocalizedTextValue.normalize(body.title), { ru: 'Худи' });
    });

    it('refuses a translation over 20 000 characters before trimming, like the old schemas', async () => {
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, title: { ru: 'Худи', en: ' '.repeat(20_001) } }), {
        'title.en': { key: 'admin.validation.tooLong', values: { max: 20_000 } },
      });
    });

    it('requires the Russian text: requiredText { locale } on the ru tab', async () => {
      for (const title of [{ en: 'Hoodie' }, { ru: '   ', en: 'Hoodie' }]) {
        deepStrictEqual(await products.fieldsOf({ ...baseProduct, title }), {
          'title.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
        });
      }
    });

    it('reports per-locale length errors as <field>.<locale> (also next to a missing Russian text)', async () => {
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, title: { ru: 'Худи', en: 'x'.repeat(201) } }), {
        'title.en': { key: 'admin.validation.tooLong', values: { max: 200 } },
      });
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, title: { en: 'x'.repeat(201) } }), {
        'title.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
        'title.en': { key: 'admin.validation.tooLong', values: { max: 200 } },
      });
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, details: { ru: 'x'.repeat(5001) } }), {
        'details.ru': { key: 'admin.validation.tooLong', values: { max: 5000 } },
      });
    });

    it('rejects unknown locales, non-string translations and a text that is not an object', async () => {
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, title: { ru: 'Худи', de: 'Hoodie' } }), {
        'title.de': { key: 'admin.validation.unknownField' },
      });
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, description: { en: 5 } }), {
        'description.en': { key: 'admin.validation.invalid' },
      });
      for (const description of ['text', null, ['a']]) {
        deepStrictEqual(await products.fieldsOf({ ...baseProduct, description }), {
          description: { key: 'admin.validation.invalid' },
        });
      }
    });
  });

  describe('products', () => {
    it('accepts a price on request (null) and the highest price', async () => {
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, price: null }), {});
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, price: PRICE_MAX }), {});
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, price: 0, imageIds: [] }), {});
    });

    it('explains each price error with its own message (an integer over the limit is not «не целое»)', async () => {
      for (const price of [PRICE_MAX + 1, 200_000_000, 2 ** 53, 1e20]) {
        deepStrictEqual(await products.fieldsOf({ ...baseProduct, price }), {
          price: { key: 'admin.validation.priceTooHigh', values: { max: PRICE_MAX } },
        });
      }
      for (const [price, key] of [
        [-1, 'admin.validation.priceNegative'],
        [-1.5, 'admin.validation.priceNegative'],
        [10.5, 'admin.validation.priceInteger'],
        ['12900', 'admin.validation.priceInteger'],
      ] as const) {
        deepStrictEqual(await products.fieldsOf({ ...baseProduct, price }), { price: { key } }, String(price));
      }
    });

    it('limits the photos to 30 different media ids', async () => {
      const many = Array.from({ length: 31 }, () => randomUUID());
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, imageIds: many }), {
        imageIds: { key: 'admin.validation.photosTooMany', values: { max: 30 } },
      });
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, imageIds: [m1, ` ${m1} `] }), {
        imageIds: { key: 'admin.validation.photosDuplicate' },
      });
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, imageIds: [m1, 'm2'] }), {
        imageIds: { key: 'admin.validation.idInvalid' },
      });
    });

    it('needs the collection id and a boolean publish flag; refuses extra fields', async () => {
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, collectionId: ' ', published: 'yes', order: 1 }), {
        collectionId: { key: 'admin.validation.idRequired' },
        published: { key: 'admin.validation.invalid' },
        order: { key: 'admin.validation.unknownField' },
      });
      deepStrictEqual(await products.fieldsOf({ ...baseProduct, collectionId: 'c1' }), {
        collectionId: { key: 'admin.validation.idInvalid' },
      });
    });
  });

  describe('collections', () => {
    it('accepts a cover or none, refuses a malformed cover id', async () => {
      deepStrictEqual(await collections.fieldsOf({ ...baseCollection, coverId: m1, published: false }), {});
      deepStrictEqual(await collections.fieldsOf({ ...baseCollection, coverId: 'cover', published: false }), {
        coverId: { key: 'admin.validation.idInvalid' },
      });
      deepStrictEqual(await collections.fieldsOf({ ...baseCollection, coverId: '', published: false }), {
        coverId: { key: 'admin.validation.idRequired' },
      });
    });
  });

  describe('reviews', () => {
    it('bounds ratings by the hard 1..10 limit (the current scale is checked by the usecase)', async () => {
      for (const rating of [null, 1, 7, 10]) {
        deepStrictEqual(await reviews.fieldsOf({ ...baseReview, rating }), {}, String(rating));
      }
      for (const [rating, error] of [
        [11, { key: 'admin.validation.ratingTooHigh', values: { max: 10 } }],
        [0, { key: 'admin.validation.ratingTooLow', values: { min: 1 } }],
        [3.5, { key: 'admin.validation.ratingInteger' }],
        ['5', { key: 'admin.validation.ratingInteger' }],
      ] as const) {
        deepStrictEqual(await reviews.fieldsOf({ ...baseReview, rating }), { rating: error }, String(rating));
      }
    });

    it('requires a trimmed author (≤ 120) and the Russian text (≤ 3000)', async () => {
      deepStrictEqual(await reviews.fieldsOf({ ...baseReview, author: '   ', text: { en: 'Great' } }), {
        author: { key: 'admin.validation.authorRequired' },
        'text.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
      });
      deepStrictEqual(
        await reviews.fieldsOf({ ...baseReview, author: 'x'.repeat(121), role: { ru: 'x'.repeat(121) } }),
        {
          author: { key: 'admin.validation.tooLong', values: { max: 120 } },
          'role.ru': { key: 'admin.validation.tooLong', values: { max: 120 } },
        },
      );
      strictEqual((await reviews.accept({ ...baseReview, author: ' Анна ' })).author, 'Анна');
    });
  });

  describe('settings', () => {
    it('accepts the contacts, an empty e-mail and phone', async () => {
      deepStrictEqual(await settings.fieldsOf(baseSettings), {});
      deepStrictEqual(await settings.fieldsOf({ ...baseSettings, phone: '', email: 'hello@example.ru' }), {});
      strictEqual((await settings.accept({ ...baseSettings, phone: ' +7 900 ' })).phone, '+7 900');
    });

    it('validates with messages from admin.validation', async () => {
      deepStrictEqual(await settings.fieldsOf({ ...baseSettings, email: 'nope', reviewRatingMax: 11 }), {
        email: { key: 'admin.validation.email' },
        reviewRatingMax: { key: 'admin.validation.starsRange', values: { min: 1, max: 10 } },
      });
      deepStrictEqual(await settings.fieldsOf({ ...baseSettings, reviewRatingMax: 0 }), {
        reviewRatingMax: { key: 'admin.validation.starsRange', values: { min: 1, max: 10 } },
      });
      deepStrictEqual(await settings.fieldsOf({ ...baseSettings, reviewRatingMax: 2.5 }), {
        reviewRatingMax: { key: 'admin.validation.starsInteger' },
      });
      deepStrictEqual(await settings.fieldsOf({ ...baseSettings, phone: 'call me' }), {
        phone: { key: 'admin.validation.phoneFormat' },
      });
    });

    it('gives the length checks of the e-mail and phone their own message', async () => {
      deepStrictEqual(await settings.fieldsOf({ ...baseSettings, email: `${'a'.repeat(200)}@example.ru` }), {
        email: { key: 'admin.validation.tooLong', values: { max: 200 } },
      });
      deepStrictEqual(await settings.fieldsOf({ ...baseSettings, phone: '1'.repeat(41) }), {
        phone: { key: 'admin.validation.tooLong', values: { max: 40 } },
      });
    });

    it('does not trim the e-mail (like the old schema) and limits the SEO texts per locale', async () => {
      ok('email' in (await settings.fieldsOf({ ...baseSettings, email: ' hello@example.ru' })));
      deepStrictEqual(await settings.fieldsOf({ ...baseSettings, seoDescription: { en: 'x'.repeat(401) } }), {
        'seoDescription.en': { key: 'admin.validation.tooLong', values: { max: 400 } },
      });
    });
  });
});
