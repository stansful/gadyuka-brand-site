import { deepStrictEqual, ok } from 'node:assert';
import { describe, it } from 'node:test';

import { DtoValidation } from '../test/dto-validation';
import { SocialLinkFieldsFactory } from './social-link-fields.factory';
import { SocialLinkInputDto } from './social-link-input.dto';

const valid = { type: 'TELEGRAM', url: 'https://t.me/gadyuka', label: {}, published: true };

describe('SocialLinkInputDto (port of the admin socialLinkInputSchema)', () => {
  it('validates the type, the http(s) url and the optional label', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(SocialLinkInputDto, valid), {});
    deepStrictEqual(
      await DtoValidation.fieldsOf(SocialLinkInputDto, { ...valid, label: { ru: 'Наш канал', en: '' } }),
      {},
    );
    deepStrictEqual(await DtoValidation.fieldsOf(SocialLinkInputDto, { ...valid, type: 'telegram' }), {
      type: { key: 'admin.validation.socialType' },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(SocialLinkInputDto, { ...valid, url: 'ftp://x' }), {
      url: { key: 'admin.validation.httpUrl' },
    });
    deepStrictEqual(
      await DtoValidation.fieldsOf(SocialLinkInputDto, { ...valid, url: null, label: { ru: 'x'.repeat(61) } }),
      {
        url: { key: 'admin.validation.httpUrl' },
        'label.ru': { key: 'admin.validation.tooLong', values: { max: 60 } },
      },
    );
  });

  it('stores an empty label as {} and the url trimmed', async () => {
    const result = await DtoValidation.validate(SocialLinkInputDto, {
      ...valid,
      url: ' https://t.me/gadyuka ',
      label: { ru: ' ', en: '' },
    });
    ok(result.ok);
    const fields = SocialLinkFieldsFactory.fromInput(result.value);
    deepStrictEqual([fields.url, fields.label], ['https://t.me/gadyuka', {}]);
  });
});
