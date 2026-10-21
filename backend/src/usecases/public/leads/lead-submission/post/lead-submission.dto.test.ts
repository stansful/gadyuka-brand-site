import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import type { MessageRef } from '~shared/contracts/errors';

import { ValidationFailedException } from '~exception';

import { ApiValidationPipe } from '../../../../../pipe/api-validation.pipe';
import { LeadSubmissionDto } from './lead-submission.dto';

/**
 * The checks of POST /public/leads, through the app's validation pipe — ported from the site's
 * validator tests (frontend src/lib/leads.test.ts): same keys, values and edge cases.
 */
const pipe = new ApiValidationPipe();
const base = { name: 'Иван Петров', consent: true, locale: 'ru', hp: '' } as const;

function validate(body: unknown): Promise<LeadSubmissionDto> {
  return pipe.transform(body, { type: 'body', metatype: LeadSubmissionDto }) as Promise<LeadSubmissionDto>;
}

async function errorsOf(body: unknown): Promise<Record<string, MessageRef>> {
  try {
    await validate(body);
  } catch (error: unknown) {
    ok(error instanceof ValidationFailedException, String(error));
    return { ...error.fields };
  }
  throw new Error(`expected a validation failure: ${JSON.stringify(body)}`);
}

const key = (name: string, values?: Record<string, number>): MessageRef =>
  values === undefined ? { key: `forms.errors.${name}` } : { key: `forms.errors.${name}`, values };

describe('LeadSubmissionDto — TAILORING', () => {
  it('accepts name + phone and trims the values', async () => {
    const dto = await validate({ ...base, type: 'TAILORING', phone: ' 8 (900) 123-45-67 ', message: '  Хочу худи  ' });
    deepStrictEqual(
      [dto.type, dto.name, dto.phone, dto.message, dto.email],
      ['TAILORING', 'Иван Петров', '8 (900) 123-45-67', 'Хочу худи', undefined],
    );
  });

  it('accepts name + email without a message', async () => {
    strictEqual(
      (await validate({ ...base, type: 'TAILORING', email: ' ivan@example.org ' })).email,
      'ivan@example.org',
    );
  });

  it('requires email or phone', async () => {
    deepStrictEqual(await errorsOf({ ...base, type: 'TAILORING', email: '', phone: '  ' }), {
      contact: key('contactRequired'),
    });
  });

  it('reports the name length limits', async () => {
    const withPhone = { ...base, type: 'TAILORING', phone: '+79001234567' };
    deepStrictEqual((await errorsOf({ ...withPhone, name: ' И ' })).name, key('tooShort', { min: 2 }));
    deepStrictEqual((await errorsOf({ ...withPhone, name: 'x'.repeat(81) })).name, key('tooLong', { max: 80 }));
    deepStrictEqual((await errorsOf({ ...withPhone, name: '' })).name, key('required'));
  });

  it('counts UTF-16 code units like the form (an emoji is two)', async () => {
    const withPhone = { ...base, type: 'TAILORING', phone: '+79001234567' };
    strictEqual((await validate({ ...withPhone, name: '😀' })).name, '😀');
    deepStrictEqual((await errorsOf({ ...withPhone, name: '😀'.repeat(41) })).name, key('tooLong', { max: 80 }));
  });

  it('rejects an invalid phone and a too long message', async () => {
    const errors = await errorsOf({ ...base, type: 'TAILORING', phone: '123', message: 'я'.repeat(2001) });
    deepStrictEqual(errors.phone, key('invalidPhone'));
    deepStrictEqual(errors.message, key('tooLong', { max: 2000 }));
  });

  it('does not ask for «e-mail or phone» when the typed one is just invalid', async () => {
    deepStrictEqual(await errorsOf({ ...base, type: 'TAILORING', phone: '12' }), { phone: key('invalidPhone') });
    deepStrictEqual(await errorsOf({ ...base, type: 'PARTNERSHIP', email: 'not-an-email' }), {
      email: key('invalidEmail'),
    });
  });

  it('requires the personal data consent', async () => {
    const withPhone = { ...base, type: 'TAILORING', phone: '+79001234567' };
    deepStrictEqual((await errorsOf({ ...withPhone, consent: false })).consent, key('consentRequired'));
    deepStrictEqual((await errorsOf({ ...withPhone, consent: 'true' })).consent, key('consentRequired'));
    deepStrictEqual(
      (await errorsOf({ type: 'TAILORING', name: 'Иван', phone: '+79001234567' })).consent,
      key('consentRequired'),
    );
  });
});

describe('LeadSubmissionDto — PARTNERSHIP', () => {
  it('accepts name + email + phone', async () => {
    const dto = await validate({
      ...base,
      type: 'PARTNERSHIP',
      email: 'shop@partner.ru',
      phone: '+7 861 200-00-01',
      message: 'Предлагаем коллаборацию',
      locale: 'en',
    });
    deepStrictEqual([dto.type, dto.locale], ['PARTNERSHIP', 'en']);
  });

  it('rejects an invalid email', async () => {
    deepStrictEqual(
      (await errorsOf({ ...base, type: 'PARTNERSHIP', email: 'not-an-email' })).email,
      key('invalidEmail'),
    );
  });
});

describe('LeadSubmissionDto — CONTACT', () => {
  it('accepts name + email', async () => {
    strictEqual(
      (await validate({ ...base, type: 'CONTACT', email: 'ivan@mail.ru', message: 'Вопрос' })).type,
      'CONTACT',
    );
  });

  it('requires the email even when a phone is given', async () => {
    deepStrictEqual((await errorsOf({ ...base, type: 'CONTACT', phone: '+79001234567' })).email, key('required'));
    deepStrictEqual((await errorsOf({ ...base, type: 'CONTACT', email: '  ' })).email, key('required'));
  });
});

describe('LeadSubmissionDto — envelope', () => {
  it('rejects unknown or missing types, and checks nothing else then', async () => {
    deepStrictEqual(await errorsOf({ ...base, type: 'SPAM', email: 'a@b.co' }), { type: key('invalidType') });
    deepStrictEqual(await errorsOf({ ...base, email: 'a@b.co' }), { type: key('invalidType') });
    deepStrictEqual(await errorsOf({}), { type: key('invalidType') });
    deepStrictEqual(await errorsOf({ type: 'NOPE', name: 1, consent: false, hp: null }), { type: key('invalidType') });
  });

  it('lets a filled honeypot through unchecked (the usecase ignores the submission)', async () => {
    strictEqual(
      (await validate({ ...base, type: 'CONTACT', email: 'a@b.co', hp: 'http://spam.example' })).hp,
      'http://spam.example',
    );
    strictEqual((await validate({ type: 'NOPE', hp: 'x' })).type, 'NOPE');
    strictEqual((await validate({ ...base, type: 'CONTACT', email: 42, hp: 1 })).hp, 1);
  });

  it('accepts an empty or missing honeypot', async () => {
    strictEqual((await validate({ ...base, type: 'CONTACT', email: 'a@b.co', hp: '' })).hp, '');
    const { hp: _hp, ...withoutHoneypot } = base;
    strictEqual((await validate({ ...withoutHoneypot, type: 'CONTACT', email: 'a@b.co' })).hp, undefined);
  });

  it('refuses fields the form does not have', async () => {
    deepStrictEqual(await errorsOf({ ...base, type: 'CONTACT', email: 'a@b.co', admin: true }), {
      admin: { key: 'admin.validation.unknownField' },
    });
  });
});

describe('LeadSubmissionDto — malformed values (API payloads)', () => {
  it('reports the first failed check per field', async () => {
    deepStrictEqual(await errorsOf({ ...base, type: 'CONTACT', name: 42, email: 'a@b.co' }), { name: key('required') });
    deepStrictEqual(await errorsOf({ ...base, type: 'CONTACT', email: `${'a'.repeat(250)}@b.co` }), {
      email: key('tooLong', { max: 254 }),
    });
    deepStrictEqual(await errorsOf({ ...base, type: 'TAILORING', phone: '1'.repeat(33) }), {
      phone: key('tooLong', { max: 32 }),
    });
    deepStrictEqual(await errorsOf({ ...base, type: 'CONTACT', email: 'a@b.co', message: 5 }), {
      message: key('invalid'),
    });
  });

  it('treats a non-text e-mail as missing where it is required and as invalid where it is optional', async () => {
    deepStrictEqual(await errorsOf({ ...base, type: 'CONTACT', email: 42 }), { email: key('required') });
    deepStrictEqual(await errorsOf({ ...base, type: 'PARTNERSHIP', email: 42 }), { email: key('invalidEmail') });
    deepStrictEqual(await errorsOf({ ...base, type: 'TAILORING', phone: 79001234567 }), { phone: key('invalidPhone') });
  });

  it('reports every failing field at once', async () => {
    const errors = await errorsOf({ type: 'TAILORING', name: 'И', message: 'я'.repeat(2001), hp: null });
    deepStrictEqual(Object.keys(errors).sort(), ['consent', 'contact', 'message', 'name', 'type']);
    deepStrictEqual(errors.type, key('invalid'));
  });

  it('refuses a referer that is not text', async () => {
    await rejects(validate({ ...base, type: 'CONTACT', email: 'a@b.co', referer: 5 }), ValidationFailedException);
  });
});
