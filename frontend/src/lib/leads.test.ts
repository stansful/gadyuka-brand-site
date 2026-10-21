import { describe, expect, it } from 'vitest';

import {
  LEAD_FORM_FIELDS,
  LEAD_LIMITS,
  LEAD_SUBJECT_MAX,
  LEAD_TOPICS,
  LEAD_TYPES,
  leadFieldsFor,
  leadIntentFromSearch,
  leadIntentHref,
  leadLocaleOf,
  leadSubject,
  normalizePhone,
  parseLeadApiResponse,
  parseLeadIntent,
  validateLeadInput,
} from './leads';

const base = { name: 'Иван Петров', consent: true, locale: 'ru', hp: '' } as const;

function errorsOf(input: unknown) {
  const result = validateLeadInput(input);
  if (result.ok || result.reason !== 'invalid') throw new Error(`expected invalid, got ${JSON.stringify(result)}`);
  return result.errors;
}

describe('normalizePhone', () => {
  it.each([
    ['+7 (900) 123-45-67', '+79001234567'],
    ['8 900 123 45 67', '+79001234567'],
    ['89001234567', '+79001234567'],
    ['9001234567', '+79001234567'],
    ['+44 20 7946 0958', '+442079460958'],
    ['+375 (29) 123-45-67', '+375291234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '12345', '+7 900 abc 45 67', 'phone', '+1234567890123456', '0000000000'])('rejects %j', input => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('validateLeadInput — TAILORING', () => {
  it('accepts name + phone and normalizes the payload', () => {
    const result = validateLeadInput({
      ...base,
      type: 'TAILORING',
      phone: '8 (900) 123-45-67',
      message: '  Хочу худи  ',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        type: 'TAILORING',
        name: 'Иван Петров',
        email: null,
        phone: '+79001234567',
        message: 'Хочу худи',
        locale: 'ru',
      },
    });
  });

  it('accepts name + email without a message', () => {
    const result = validateLeadInput({ ...base, type: 'TAILORING', email: ' ivan@example.org ' });
    expect(result.ok && result.data.email).toBe('ivan@example.org');
    expect(result.ok && result.data.message).toBe('');
  });

  it('requires email or phone', () => {
    expect(errorsOf({ ...base, type: 'TAILORING', email: '', phone: '  ' })).toEqual({
      contact: { code: 'contactRequired' },
    });
  });

  it('reports name length limits', () => {
    expect(errorsOf({ ...base, type: 'TAILORING', name: ' И ', phone: '+79001234567' }).name).toEqual({
      code: 'tooShort',
      min: LEAD_LIMITS.nameMin,
    });
    expect(errorsOf({ ...base, type: 'TAILORING', name: 'x'.repeat(81), phone: '+79001234567' }).name).toEqual({
      code: 'tooLong',
      max: LEAD_LIMITS.nameMax,
    });
    expect(errorsOf({ ...base, type: 'TAILORING', name: '', phone: '+79001234567' }).name).toEqual({
      code: 'required',
    });
  });

  it('rejects an invalid phone and a too long message', () => {
    const errors = errorsOf({ ...base, type: 'TAILORING', phone: '123', message: 'я'.repeat(2001) });
    expect(errors.phone).toEqual({ code: 'invalidPhone' });
    expect(errors.message).toEqual({ code: 'tooLong', max: 2000 });
  });

  it('does not ask for «e-mail or phone» when the typed one is just invalid', () => {
    expect(errorsOf({ ...base, type: 'TAILORING', phone: '12' })).toEqual({ phone: { code: 'invalidPhone' } });
    expect(errorsOf({ ...base, type: 'PARTNERSHIP', email: 'not-an-email' })).toEqual({
      email: { code: 'invalidEmail' },
    });
  });

  it('requires the personal data consent', () => {
    expect(errorsOf({ ...base, type: 'TAILORING', phone: '+79001234567', consent: false }).consent).toEqual({
      code: 'consentRequired',
    });
    expect(errorsOf({ type: 'TAILORING', name: 'Иван', phone: '+79001234567' }).consent).toEqual({
      code: 'consentRequired',
    });
  });
});

describe('validateLeadInput — PARTNERSHIP', () => {
  it('accepts name + email + phone', () => {
    const result = validateLeadInput({
      ...base,
      type: 'PARTNERSHIP',
      email: 'shop@partner.ru',
      phone: '+7 861 200-00-01',
      message: 'Предлагаем коллаборацию',
      locale: 'en',
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toMatchObject({ type: 'PARTNERSHIP', phone: '+78612000001', locale: 'en' });
  });

  it('rejects an invalid email', () => {
    expect(errorsOf({ ...base, type: 'PARTNERSHIP', email: 'not-an-email' }).email).toEqual({ code: 'invalidEmail' });
  });
});

describe('validateLeadInput — CONTACT', () => {
  it('accepts name + email', () => {
    const result = validateLeadInput({ ...base, type: 'CONTACT', email: 'ivan@mail.ru', message: 'Вопрос' });
    expect(result.ok).toBe(true);
  });

  it('requires the email even when a phone is given', () => {
    expect(errorsOf({ ...base, type: 'CONTACT', phone: '+79001234567' }).email).toEqual({ code: 'required' });
    expect(errorsOf({ ...base, type: 'CONTACT', email: '  ' }).email).toEqual({ code: 'required' });
  });
});

describe('validateLeadInput — envelope', () => {
  it('rejects unknown or missing types', () => {
    expect(errorsOf({ ...base, type: 'SPAM', email: 'a@b.co' })).toEqual({ type: { code: 'invalidType' } });
    expect(errorsOf({ ...base, email: 'a@b.co' })).toEqual({ type: { code: 'invalidType' } });
    expect(errorsOf('not an object')).toEqual({ type: { code: 'invalidType' } });
    expect(errorsOf(null)).toEqual({ type: { code: 'invalidType' } });
  });

  it('falls back to ru for unknown locales', () => {
    const result = validateLeadInput({ ...base, type: 'CONTACT', email: 'a@b.co', locale: 'de' });
    expect(result.ok && result.data.locale).toBe('ru');
    expect(leadLocaleOf({ locale: 'en' })).toBe('en');
    expect(leadLocaleOf({ locale: 42 })).toBe('ru');
    expect(leadLocaleOf(undefined)).toBe('ru');
  });

  it('flags a filled honeypot before any other validation', () => {
    expect(validateLeadInput({ ...base, type: 'CONTACT', email: 'a@b.co', hp: 'http://spam.example' })).toEqual({
      ok: false,
      reason: 'honeypot',
    });
    expect(validateLeadInput({ type: 'NOPE', hp: 'x' })).toEqual({ ok: false, reason: 'honeypot' });
    expect(validateLeadInput({ ...base, type: 'CONTACT', email: 'a@b.co', hp: 1 })).toEqual({
      ok: false,
      reason: 'honeypot',
    });
  });

  it('accepts an empty or missing honeypot', () => {
    expect(validateLeadInput({ ...base, type: 'CONTACT', email: 'a@b.co', hp: '' }).ok).toBe(true);
    const { hp: _hp, ...withoutHoneypot } = base;
    expect(validateLeadInput({ ...withoutHoneypot, type: 'CONTACT', email: 'a@b.co' }).ok).toBe(true);
  });
});

describe('validateLeadInput — malformed values (API payloads)', () => {
  it('reports the first failed check per field', () => {
    expect(errorsOf({ ...base, type: 'CONTACT', name: 42, email: 'a@b.co' })).toEqual({ name: { code: 'required' } });
    expect(errorsOf({ ...base, type: 'CONTACT', email: `${'a'.repeat(250)}@b.co` })).toEqual({
      email: { code: 'tooLong', max: LEAD_LIMITS.emailMax },
    });
    expect(errorsOf({ ...base, type: 'TAILORING', phone: '1'.repeat(33) })).toEqual({
      phone: { code: 'tooLong', max: LEAD_LIMITS.phoneMax },
    });
    expect(errorsOf({ ...base, type: 'CONTACT', email: 'a@b.co', message: 5 })).toEqual({
      message: { code: 'invalid' },
    });
  });

  it('treats a non-text e-mail as missing where it is required and as invalid where it is optional', () => {
    expect(errorsOf({ ...base, type: 'CONTACT', email: 42 })).toEqual({ email: { code: 'required' } });
    expect(errorsOf({ ...base, type: 'PARTNERSHIP', email: 42 })).toEqual({ email: { code: 'invalidEmail' } });
    expect(errorsOf({ ...base, type: 'TAILORING', phone: 79001234567 })).toEqual({ phone: { code: 'invalidPhone' } });
  });

  it('reports every failing field at once, in the order of the form', () => {
    const errors = errorsOf({ type: 'TAILORING', name: 'И', message: 'я'.repeat(2001), hp: null });
    expect(Object.keys(errors)).toEqual(['name', 'message', 'consent', 'type', 'contact']);
    expect(errors.type).toEqual({ code: 'invalid' });
  });
});

describe('form configuration', () => {
  it('shows the email first and requires it in the contact form', () => {
    expect(LEAD_FORM_FIELDS.CONTACT[0]).toEqual({ name: 'email', required: true });
    expect(LEAD_FORM_FIELDS.CONTACT.some(field => field.name === 'phone')).toBe(false);
  });

  it('offers every lead type exactly once as a topic, each with its message', () => {
    expect(LEAD_TOPICS.map(topic => topic.type).sort()).toEqual([...LEAD_TYPES].sort());
    expect(Object.fromEntries(LEAD_TOPICS.map(topic => [topic.type, topic.key]))).toEqual({
      TAILORING: 'contacts.form.topics.tailoring',
      PARTNERSHIP: 'contacts.form.topics.partnership',
      CONTACT: 'contacts.form.topics.contact',
    });
  });

  it('keeps one display order and shows the phone only where e-mail is optional', () => {
    expect(leadFieldsFor('CONTACT').map(field => field.name)).toEqual(['email', 'name', 'message']);
    expect(leadFieldsFor('TAILORING').map(field => field.name)).toEqual(['email', 'name', 'phone', 'message']);
    expect(leadFieldsFor('PARTNERSHIP').find(field => field.name === 'email')?.required).toBe(false);
    expect(leadFieldsFor('CONTACT').find(field => field.name === 'email')?.required).toBe(true);
  });
});

describe('lead intents', () => {
  it('accepts known types and normalizes the subject', () => {
    expect(parseLeadIntent({ type: 'TAILORING', subject: '  Заказ:\n Худи  ' })).toEqual({
      type: 'TAILORING',
      subject: 'Заказ: Худи',
    });
    expect(parseLeadIntent({ type: 'CONTACT' })).toEqual({ type: 'CONTACT', subject: '' });
    expect(parseLeadIntent({ type: 'SPAM', subject: 'x' })).toBeNull();
    expect(parseLeadIntent({ type: 'CONTACT', subject: 'x'.repeat(500) })?.subject).toHaveLength(LEAD_SUBJECT_MAX);
  });

  it('round-trips through a cross-page link', () => {
    const href = leadIntentHref('/en', { type: 'CONTACT', subject: 'Order: Sign Hoodie — White' }, 'lead-form');
    expect(href.startsWith('/en?topic=CONTACT&subject=')).toBe(true);
    expect(href.endsWith('#lead-form')).toBe(true);
    const search = href.slice(href.indexOf('?'), href.indexOf('#'));
    expect(leadIntentFromSearch(search)).toEqual({ type: 'CONTACT', subject: 'Order: Sign Hoodie — White' });
    expect(leadIntentFromSearch('?utm_source=x')).toBeNull();
    expect(leadIntentFromSearch('?topic=nope')).toBeNull();
  });

  it('cleans a subject filled in from its message, falling back to the name when the message is blank', () => {
    expect(leadSubject('Заказ:  Худи\n«Знак»', 'Худи «Знак»')).toBe('Заказ: Худи «Знак»');
    expect(leadSubject('  ', 'Худи')).toBe('Худи');
    expect(leadSubject('Купон: Скидка', ' ')).toBe('Купон: Скидка');
    expect(leadSubject('x'.repeat(500))).toHaveLength(LEAD_SUBJECT_MAX);
  });
});

describe('parseLeadApiResponse', () => {
  it('parses success and failure bodies', () => {
    expect(parseLeadApiResponse({ ok: true, id: 'abc' })).toEqual({ ok: true, id: 'abc' });
    expect(
      parseLeadApiResponse({
        ok: false,
        error: 'invalid_form',
        message: 'Проверьте поля формы',
        fieldErrors: { email: 'Укажите корректный e-mail' },
      }),
    ).toEqual({
      ok: false,
      error: 'invalid_form',
      message: 'Проверьте поля формы',
      fieldErrors: { email: 'Укажите корректный e-mail' },
    });
    expect(parseLeadApiResponse({ ok: false, error: 'rate_limited', message: 'Подождите', retryAfter: 30 })).toEqual({
      ok: false,
      error: 'rate_limited',
      message: 'Подождите',
      retryAfter: 30,
    });
  });

  it('keeps only the known properties', () => {
    expect(parseLeadApiResponse({ ok: true, id: 'abc', debug: 1 })).toEqual({ ok: true, id: 'abc' });
    expect(parseLeadApiResponse({ ok: false, error: 'server_error', message: 'm', stack: 'x' })).toEqual({
      ok: false,
      error: 'server_error',
      message: 'm',
    });
  });

  it.each([
    null,
    'not json',
    [],
    { ok: true },
    { ok: true, id: 1 },
    { ok: 'false', error: 'server_error', message: 'm' },
    { ok: false, error: 'teapot', message: '?' },
    { ok: false, error: 'server_error' },
    { ok: false, error: 'invalid_form', message: 'm', fieldErrors: { nope: 'x' } },
    { ok: false, error: 'invalid_form', message: 'm', fieldErrors: { email: 1 } },
    { ok: false, error: 'invalid_form', message: 'm', fieldErrors: null },
    { ok: false, error: 'rate_limited', message: 'm', retryAfter: '30' },
  ])('rejects %j', body => {
    expect(parseLeadApiResponse(body)).toBeNull();
  });
});
