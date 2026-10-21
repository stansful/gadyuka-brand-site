import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { DtoValidation } from '../test/dto-validation';
import { PartnerFieldsFactory } from './partner-fields.factory';
import { PartnerInputDto } from './partner-input.dto';

const valid = { name: 'Бренд', url: 'https://example.ru', logoId: null, description: {}, published: true };

describe('PartnerInputDto (port of the admin partnerInputSchema)', () => {
  it('trims the name and requires it', async () => {
    const result = await DtoValidation.validate(PartnerInputDto, { ...valid, name: '  Бренд ' });
    ok(result.ok);
    strictEqual(result.value.name, 'Бренд');
    deepStrictEqual(await DtoValidation.fieldsOf(PartnerInputDto, { ...valid, name: '   ' }), {
      name: { key: 'admin.validation.nameRequired' },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(PartnerInputDto, { ...valid, name: 'x'.repeat(121) }), {
      name: { key: 'admin.validation.tooLong', values: { max: 120 } },
    });
  });

  it('takes an http(s) link or null; a long link gets its own message', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(PartnerInputDto, { ...valid, url: null }), {});
    deepStrictEqual(await DtoValidation.fieldsOf(PartnerInputDto, { ...valid, url: 'ftp://x' }), {
      url: { key: 'admin.validation.httpUrl' },
    });
    deepStrictEqual(
      await DtoValidation.fieldsOf(PartnerInputDto, { ...valid, url: `https://example.ru/${'a'.repeat(500)}` }),
      {
        url: { key: 'admin.validation.tooLong', values: { max: 500 } },
      },
    );
  });

  it('limits the description per translation', async () => {
    deepStrictEqual(
      await DtoValidation.fieldsOf(PartnerInputDto, { ...valid, description: { en: 'x'.repeat(3001) } }),
      {
        'description.en': { key: 'admin.validation.tooLong', values: { max: 3000 } },
      },
    );
  });
});

describe('PartnerFieldsFactory', () => {
  it('stores the link trimmed and the description normalized', async () => {
    const result = await DtoValidation.validate(PartnerInputDto, {
      ...valid,
      url: ' https://example.ru/a ',
      description: { ru: ' Описание ' },
    });
    ok(result.ok);
    const fields = PartnerFieldsFactory.fromInput(result.value);
    deepStrictEqual([fields.url, fields.description], ['https://example.ru/a', { ru: 'Описание' }]);
  });
});
