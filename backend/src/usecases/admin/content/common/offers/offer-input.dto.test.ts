import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { DtoValidation } from '../test/dto-validation';
import { OfferFieldsFactory } from './offer-fields.factory';
import { OfferInputDto } from './offer-input.dto';

const valid = {
  title: { ru: 'Скидка' },
  text: {},
  badge: {},
  ctaLabel: { ru: 'Купить' },
  ctaHref: '#contacts',
  validUntil: null,
  imageId: null,
  published: true,
};

describe('OfferInputDto (port of the admin offerInputSchema)', () => {
  it('accepts every kind of site link for the button, trimmed', async () => {
    for (const ctaHref of [
      '#contacts',
      '/en#tailoring',
      'https://t.me/gadyuka',
      'mailto:hi@example.ru',
      'tel:+79000000000',
    ]) {
      deepStrictEqual(await DtoValidation.fieldsOf(OfferInputDto, { ...valid, ctaHref }), {}, ctaHref);
    }
    const result = await DtoValidation.validate(OfferInputDto, { ...valid, ctaHref: ' #contacts ' });
    ok(result.ok);
    strictEqual(result.value.ctaHref, '#contacts');
  });

  it('refuses javascript: and protocol-relative links, too long ones and non-strings', async () => {
    for (const ctaHref of ['javascript:alert(1)', '//evil.example', '']) {
      deepStrictEqual(await DtoValidation.fieldsOf(OfferInputDto, { ...valid, ctaHref }), {
        ctaHref: { key: 'admin.validation.siteHref' },
      });
    }
    deepStrictEqual(await DtoValidation.fieldsOf(OfferInputDto, { ...valid, ctaHref: `/${'a'.repeat(500)}` }), {
      ctaHref: { key: 'admin.validation.tooLong', values: { max: 500 } },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(OfferInputDto, { ...valid, ctaHref: 5 }), {
      ctaHref: { key: 'admin.validation.invalid' },
    });
  });

  it('takes null for no link and no end date, and refuses a missing key', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(OfferInputDto, { ...valid, ctaLabel: {}, ctaHref: null }), {});
    const withoutHref: Record<string, unknown> = { ...valid };
    delete withoutHref.ctaHref;
    deepStrictEqual(await DtoValidation.fieldsOf(OfferInputDto, withoutHref), {
      ctaHref: { key: 'admin.validation.invalid' },
    });
  });

  it('checks the last day and the per-field text limits', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(OfferInputDto, { ...valid, validUntil: '2026-02-30' }), {
      validUntil: { key: 'admin.validation.dateRequired' },
    });
    deepStrictEqual(
      await DtoValidation.fieldsOf(OfferInputDto, {
        ...valid,
        badge: { ru: 'x'.repeat(41) },
        ctaLabel: { en: 'x'.repeat(61) },
      }),
      {
        'badge.ru': { key: 'admin.validation.tooLong', values: { max: 40 } },
        'ctaLabel.en': { key: 'admin.validation.tooLong', values: { max: 60 } },
      },
    );
    deepStrictEqual(
      await DtoValidation.fieldsOf(OfferInputDto, { ...valid, title: { en: 'Sale' }, text: { ru: 'x'.repeat(3001) } }),
      {
        'title.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
        'text.ru': { key: 'admin.validation.tooLong', values: { max: 3000 } },
      },
    );
  });
});

describe('OfferFieldsFactory', () => {
  it('stores the last day until 23:59:59.999 Moscow time, texts normalized', async () => {
    const result = await DtoValidation.validate(OfferInputDto, {
      ...valid,
      validUntil: '2026-10-31',
      badge: { ru: ' −15% ', en: '' },
    });
    ok(result.ok);
    const fields = OfferFieldsFactory.fromInput(result.value);
    strictEqual(fields.validUntil?.toISOString(), '2026-10-31T20:59:59.999Z');
    deepStrictEqual(fields.badge, { ru: '−15%' });
    strictEqual(OfferFieldsFactory.fromInput({ ...result.value, validUntil: null, ctaHref: null }).validUntil, null);
  });
});
