import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import { DtoValidation } from '../test/dto-validation';
import { NewsFieldsFactory } from './news-fields.factory';
import { NewsInputDto } from './news-input.dto';

const valid = {
  slug: 'pop-up',
  title: { ru: 'Поп-ап' },
  excerpt: {},
  body: { ru: 'Текст' },
  date: '2026-10-01',
  imageId: null,
  published: true,
};

describe('NewsInputDto (port of the admin newsInputSchema)', () => {
  it('accepts a valid news form and trims + lowercases the slug', async () => {
    const result = await DtoValidation.validate(NewsInputDto, { ...valid, slug: ' Menya-Zapomnyat ' });
    ok(result.ok);
    strictEqual(result.value.slug, 'menya-zapomnyat');
  });

  it('refuses slugs that are not latin words joined by single hyphens, and empty / too long ones', async () => {
    for (const slug of ['два слова', '-edge-', 'a--b']) {
      deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, slug }), {
        slug: { key: 'admin.validation.slugFormat' },
      });
    }
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, slug: '  ' }), {
      slug: { key: 'admin.validation.slugRequired' },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, slug: 'a'.repeat(121) }), {
      slug: { key: 'admin.validation.tooLong', values: { max: 120 } },
    });
  });

  it('requires the Russian title and reports per-locale lengths as <field>.<locale>', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, title: { en: 'Pop-up' } }), {
      'title.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, title: { ru: ' ', en: 'x'.repeat(201) } }), {
      'title.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
      'title.en': { key: 'admin.validation.tooLong', values: { max: 200 } },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, body: { en: 'x'.repeat(20_001) } }), {
      'body.en': { key: 'admin.validation.tooLong', values: { max: 20_000 } },
    });
  });

  it('measures a translation once trimmed (the stored value)', async () => {
    const padded = `  ${'x'.repeat(200)}  `;
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, title: { ru: padded } }), {});
  });

  it('refuses unknown locales, non-object texts and non-string translations', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, title: { ru: 'Поп-ап', de: 'Pop-up' } }), {
      'title.de': { key: 'admin.validation.unknownField' },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, excerpt: 'text' }), {
      excerpt: { key: 'admin.validation.invalid' },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, excerpt: { en: 5 } }), {
      'excerpt.en': { key: 'admin.validation.invalid' },
    });
  });

  it('accepts real calendar days only', async () => {
    for (const date of ['2028-02-29', '2026-12-31']) {
      deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, date }), {}, date);
    }
    for (const date of ['', '2026-02-29', '2026-13-01', '01.10.2026', '2026-10-01T12:00:00Z', null]) {
      deepStrictEqual(
        await DtoValidation.fieldsOf(NewsInputDto, { ...valid, date }),
        { date: { key: 'admin.validation.dateRequired' } },
        String(date),
      );
    }
  });

  it('takes a media id or null as the picture', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, imageId: randomUUID() }), {});
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, imageId: 'seed-media-1' }), {
      imageId: { key: 'admin.validation.idInvalid' },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, imageId: ' ' }), {
      imageId: { key: 'admin.validation.idRequired' },
    });
  });

  it('refuses a flag that is not a boolean and unknown fields', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(NewsInputDto, { ...valid, published: 'yes', order: 1 }), {
      published: { key: 'admin.validation.invalid' },
      order: { key: 'admin.validation.unknownField' },
    });
  });
});

describe('NewsFieldsFactory', () => {
  it('stores texts trimmed without empty translations and the day as noon Moscow time', async () => {
    const result = await DtoValidation.validate(NewsInputDto, {
      ...valid,
      title: { ru: ' Поп-ап ', en: '' },
      excerpt: { en: '  ' },
    });
    ok(result.ok);
    const fields = NewsFieldsFactory.fromInput(result.value);
    deepStrictEqual(fields.title, { ru: 'Поп-ап' });
    deepStrictEqual(fields.excerpt, {});
    strictEqual(fields.date.toISOString(), '2026-10-01T09:00:00.000Z');
  });
});
