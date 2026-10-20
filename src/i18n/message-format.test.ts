import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { defaultMessageFormat, hasMessageSyntax, parseMessageFormat, validateMessageValue } from './message-format';
import {
  DEFAULT_MESSAGES,
  flattenMessages,
  isMessageKey,
  MESSAGE_KEYS,
  unflattenMessages,
  type SiteMessages,
} from './messages';

describe('message keys', () => {
  it('are the string leaves of messages/ru.json, numeric segments included', () => {
    expect(MESSAGE_KEYS).toContain('hero.title');
    expect(MESSAGE_KEYS).toContain('about.advantages.0.title');
    expect(MESSAGE_KEYS).toContain('forms.errors.tooShort');
    expect(isMessageKey('forms.errors')).toBe(false); // a branch, not a message
    expect(isMessageKey('header.nav.home')).toBe(false); // menu labels are MenuItem rows
  });

  it('flatten and unflatten are inverse', () => {
    const tree = { a: { b: 'x', c: { '0': { d: 'y' } } }, e: 'z' };
    const flat = flattenMessages(tree);
    expect(flat).toEqual({ 'a.b': 'x', 'a.c.0.d': 'y', e: 'z' });
    expect(unflattenMessages(flat)).toEqual(tree);
    expect(() => unflattenMessages({ a: 'x', 'a.b': 'y' })).toThrow();
  });
});

describe('ICU checks of admin-edited values', () => {
  it('reads the arguments and tags of the defaults', () => {
    expect(defaultMessageFormat('catalog.models')).toEqual({ arguments: ['count'], tags: [] });
    expect(defaultMessageFormat('common.switchLanguageTo')).toEqual({ arguments: ['language'], tags: ['lang'] });
    expect(defaultMessageFormat('hero.title')).toEqual({ arguments: [], tags: [] });
  });

  it('accepts plain text, the default arguments and blank values', () => {
    expect(validateMessageValue('hero.title', 'ГАДЮКА — It’s on')).toEqual([]);
    expect(validateMessageValue('forms.errors.tooShort', 'Минимум {min}')).toEqual([]);
    expect(validateMessageValue('forms.errors.tooShort', 'Слишком коротко')).toEqual([]);
    expect(validateMessageValue('catalog.models', '{count, plural, one {# вещь} other {# вещей}}')).toEqual([]);
    expect(validateMessageValue('offers.fine', '')).toEqual([]);
  });

  it('rejects broken syntax, unknown arguments and tags, and a dropped tag', () => {
    expect(validateMessageValue('hero.title', 'Скидка {10%')).toEqual([{ code: 'syntax', error: expect.any(String) }]);
    expect(validateMessageValue('forms.errors.tooShort', 'Минимум {max}')).toEqual([
      { code: 'unknownArgument', name: 'max' },
    ]);
    expect(validateMessageValue('hero.title', '<b>ГАДЮКА</b>')).toEqual([{ code: 'unknownTag', name: 'b' }]);
    expect(validateMessageValue('common.switchLanguageTo', 'Язык: {language}')).toEqual([
      { code: 'missingTag', name: 'lang' },
    ]);
  });

  it('detects ICU syntax cheaply', () => {
    expect(hasMessageSyntax('Фото {number}')).toBe(true);
    expect(hasMessageSyntax('на <lang>{language}</lang>')).toBe(true);
    expect(hasMessageSyntax('a < b, «кавычки»')).toBe(false);
    expect(parseMessageFormat('a < b').ok).toBe(true);
  });
});

describe('simple templates (syntax "template": filled in by the client components)', () => {
  const template = { syntax: 'template' } as const;

  it('accepts literal text with the bare placeholders and the tag of the default', () => {
    expect(validateMessageValue('forms.errors.tooShort', 'Минимум символов: {min}', template)).toEqual([]);
    expect(validateMessageValue('forms.errors.tooShort', "Don’t, can't — {min}", template)).toEqual([]);
    expect(validateMessageValue('gallery.counter', 'Фото {current} из {total}', template)).toEqual([]);
    expect(validateMessageValue('common.switchLanguageTo', 'Язык: <lang>{language}</lang>!', template)).toEqual([]);
    expect(validateMessageValue('contacts.form.subjectLine', '{subject} — тема письма', template)).toEqual([]);
  });

  it('rejects plural forms, selects and formats (a plain replace would show them raw)', () => {
    const plural = 'Слишком коротко — минимум {min, plural, one {# символ} few {# символа} other {# символов}}';
    expect(validateMessageValue('forms.errors.tooShort', plural, template)).toEqual([
      { code: 'templateFormat', name: 'min' },
    ]);
    expect(validateMessageValue('forms.errors.tooShort', plural)).toEqual([]); // fine in full ICU
    expect(validateMessageValue('gallery.counter', '{current} из {total, number}', template)).toEqual([
      { code: 'templateFormat', name: 'total' },
    ]);
    expect(
      validateMessageValue('contacts.form.subjectLine', 'Re: {subject, select, other {{subject}}}', template),
    ).toEqual([{ code: 'templateFormat', name: 'subject' }]);
  });

  it('rejects tokens the client would not find, repeats and apostrophe quoting', () => {
    expect(validateMessageValue('forms.errors.tooShort', 'Минимум { min }', template)).toEqual([
      { code: 'templateToken', token: '{min}' },
    ]);
    for (const value of ['Язык: <lang>{ language }</lang>', 'Переключить язык на <lang>«{language}»</lang>']) {
      expect(validateMessageValue('common.switchLanguageTo', value, template)).toEqual([
        { code: 'templateToken', token: '<lang>{language}</lang>' },
      ]);
    }
    expect(validateMessageValue('contacts.form.subjectLine', 'По поводу: {subject} ({subject})', template)).toEqual([
      { code: 'templateRepeat', token: '{subject}' },
    ]);
    expect(validateMessageValue('forms.errors.tooShort', "It''s {min}", template)).toEqual([{ code: 'templateQuote' }]);
    expect(validateMessageValue('forms.errors.tooShort', "Скобка '{' и {min}", template)).toEqual([
      { code: 'templateQuote' },
    ]);
  });
});

describe('trial format (what next-intl does at render time)', () => {
  type Case = { key: 'catalog.models' | 'catalog.orderSubject'; value: string };
  const SAMPLE_COUNTS = [0, 1, 2, 3, 5, 21];
  const LEAF = { 'catalog.models': 'models', 'catalog.orderSubject': 'orderSubject' } as const;

  /** Whether next-intl t() renders `value` as the ru text of `key` for every sample argument. */
  function rendersInNextIntl({ key, value }: Case): boolean {
    const ru = DEFAULT_MESSAGES.ru;
    const messages: SiteMessages = { ...ru, catalog: { ...ru.catalog, [LEAF[key]]: value } };
    let failed = false;
    const t = createTranslator({
      locale: 'ru',
      messages,
      timeZone: 'Europe/Moscow',
      onError: () => {
        failed = true;
      },
    });
    for (const count of SAMPLE_COUNTS) {
      if (key === 'catalog.models') t(key, { count });
      else t(key, { product: 'Худи «Яд»' });
    }
    return !failed;
  }

  const cases: Case[] = [
    { key: 'catalog.models', value: '{count, plural, one {# вещь} other {# вещей}}' },
    { key: 'catalog.models', value: '{count, number, ::currency/USD}' },
    { key: 'catalog.models', value: '{count, number, ::currency/XY}' },
    { key: 'catalog.models', value: '{count, number, currency}' },
    { key: 'catalog.models', value: '{count, number, ::unit/foo}' },
    // a broken format in a branch only some counts select
    { key: 'catalog.models', value: '{count, plural, one {{count, number, ::unit/foo}} other {# шт.}}' },
    { key: 'catalog.orderSubject', value: 'Заказ: {product, select, other {«{product}»}}' },
    { key: 'catalog.orderSubject', value: 'Заказ от {product, date}' }, // a text formatted as a date
  ];

  it('refuses exactly the values next-intl cannot format', () => {
    const verdicts = cases.map(item => ({
      ...item,
      accepted: validateMessageValue(item.key, item.value, { locale: 'ru' }).length === 0,
    }));
    expect(verdicts.map(item => item.accepted)).toEqual(cases.map(rendersInNextIntl));
    expect(verdicts.filter(item => !item.accepted)).toHaveLength(5);
  });

  it('names the broken format', () => {
    expect(validateMessageValue('catalog.models', 'Модели: {count, number, ::currency/XY}')).toEqual([
      { code: 'format', token: '{count, number, ::currency/XY}', error: expect.stringMatching(/currency/i) },
    ]);
    expect(
      validateMessageValue('catalog.models', '{count, plural, one {{count, number, ::unit/foo}} other {# шт.}}'),
    ).toEqual([{ code: 'format', token: '{count, number, ::unit/foo}', error: expect.any(String) }]);
  });
});
