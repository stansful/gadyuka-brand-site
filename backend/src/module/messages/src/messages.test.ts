import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert';
import { describe, it } from 'node:test';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import {
  IcuMessageParser,
  MessageCatalog,
  MessageFormatter,
  MessageIssueCode,
  MessagesDirectory,
  MessageSyntax,
  MessageTreeFlattener,
  MessageValueValidator,
} from '~module/messages';

describe('MessageCatalog (shared/messages)', () => {
  const catalog = new MessageCatalog(MessagesDirectory.locate());

  it('keys are the string leaves of ru.json, numeric segments included', () => {
    const keys = catalog.siteKeys();
    ok(keys.includes('hero.title'));
    ok(keys.includes('about.advantages.0.title'));
    ok(keys.includes('forms.errors.tooShort'));
    strictEqual(catalog.isSiteKey('forms.errors'), false, 'a branch is not a message');
    strictEqual(catalog.isSiteKey('header.nav.home'), false, 'menu labels are MenuItem rows');
  });

  it('every locale has exactly the keys of ru.json', () => {
    const ruKeys = [...catalog.siteKeys()].sort();
    for (const locale of LocaleMap.LOCALES) {
      deepStrictEqual(Object.keys(catalog.siteDefaults(locale)).sort(), ruKeys, locale);
    }
  });

  it('every default is valid ICU', () => {
    const parser = new IcuMessageParser();
    for (const locale of LocaleMap.LOCALES) {
      for (const [key, value] of Object.entries(catalog.siteDefaults(locale))) {
        ok(parser.parse(value).ok, `${locale}: ${key}`);
      }
    }
  });

  it('has every admin message key the backend answers with', () => {
    for (const key of Object.values(AdminMessageKey)) {
      ok(catalog.findAdminMessage(key) !== undefined, key);
    }
    strictEqual(catalog.findAdminMessage('admin.auth'), undefined, 'a branch is not a message');
  });

  it('returns a copy of the tree', () => {
    const tree = catalog.siteTree(Locale.RU);
    ok(typeof tree.hero === 'object');
    ok(tree !== catalog.siteTree(Locale.RU));
  });
});

describe('MessageTreeFlattener', () => {
  const flattener = new MessageTreeFlattener();

  it('flatten and unflatten are inverse', () => {
    const tree = { a: { b: 'x', c: { '0': { d: 'y' } } }, e: 'z' };
    const flat = flattener.flatten(tree);
    deepStrictEqual(flat, { 'a.b': 'x', 'a.c.0.d': 'y', e: 'z' });
    deepStrictEqual(flattener.unflatten(flat), tree);
  });

  it('refuses a key that is both a leaf and a branch, or has an empty segment', () => {
    throws(() => flattener.unflatten({ a: 'x', 'a.b': 'y' }));
    throws(() => flattener.unflatten({ 'a.b': 'y', a: 'x' }));
    throws(() => flattener.unflatten({ 'a..b': 'x' }));
  });
});

describe('MessageFormatter', () => {
  it('formats ICU arguments and plurals in the given locale', () => {
    const formatter = new MessageFormatter();
    strictEqual(formatter.format('Новая заявка: {type}', Locale.RU, { type: 'Пошив' }), 'Новая заявка: Пошив');
    strictEqual(
      formatter.format('{n, plural, one {# вещь} few {# вещи} other {# вещей}}', Locale.RU, { n: 3 }),
      '3 вещи',
    );
  });
});

describe('ICU checks of admin-edited values (MessageValueValidator)', () => {
  const validator = new MessageValueValidator(new MessageCatalog(MessagesDirectory.locate()));
  const template = { syntax: MessageSyntax.TEMPLATE };

  it('reads the arguments and tags of the defaults', () => {
    deepStrictEqual(validator.defaultFormat('catalog.models'), { arguments: ['count'], tags: [] });
    deepStrictEqual(validator.defaultFormat('common.switchLanguageTo'), { arguments: ['language'], tags: ['lang'] });
    deepStrictEqual(validator.defaultFormat('hero.title'), { arguments: [], tags: [] });
  });

  it('accepts plain text, the default arguments and blank values', () => {
    deepStrictEqual(validator.validate('hero.title', 'ГАДЮКА — It’s on'), []);
    deepStrictEqual(validator.validate('forms.errors.tooShort', 'Минимум {min}'), []);
    deepStrictEqual(validator.validate('forms.errors.tooShort', 'Слишком коротко'), []);
    deepStrictEqual(validator.validate('catalog.models', '{count, plural, one {# вещь} other {# вещей}}'), []);
    deepStrictEqual(validator.validate('offers.fine', ''), []);
  });

  it('rejects broken syntax, unknown arguments and tags, and a dropped tag', () => {
    const [syntax] = validator.validate('hero.title', 'Скидка {10%');
    strictEqual(syntax?.code, 'syntax');
    deepStrictEqual(validator.validate('forms.errors.tooShort', 'Минимум {max}'), [
      { code: 'unknownArgument', name: 'max' },
    ]);
    deepStrictEqual(validator.validate('hero.title', '<b>ГАДЮКА</b>'), [{ code: 'unknownTag', name: 'b' }]);
    deepStrictEqual(validator.validate('common.switchLanguageTo', 'Язык: {language}'), [
      { code: 'missingTag', name: 'lang' },
    ]);
  });

  it('detects ICU syntax cheaply', () => {
    strictEqual(validator.hasSyntax('Фото {number}'), true);
    strictEqual(validator.hasSyntax('на <lang>{language}</lang>'), true);
    strictEqual(validator.hasSyntax('a < b, «кавычки»'), false);
    strictEqual(validator.parseFormat('a < b').ok, true);
  });

  describe('simple templates (filled in by the client components)', () => {
    it('accepts literal text with the bare placeholders and the tag of the default', () => {
      deepStrictEqual(validator.validate('forms.errors.tooShort', 'Минимум символов: {min}', template), []);
      deepStrictEqual(validator.validate('forms.errors.tooShort', "Don’t, can't — {min}", template), []);
      deepStrictEqual(validator.validate('gallery.counter', 'Фото {current} из {total}', template), []);
      deepStrictEqual(validator.validate('common.switchLanguageTo', 'Язык: <lang>{language}</lang>!', template), []);
      deepStrictEqual(validator.validate('contacts.form.subjectLine', '{subject} — тема письма', template), []);
    });

    it('rejects plural forms, selects and formats (a plain replace would show them raw)', () => {
      const plural = 'Слишком коротко — минимум {min, plural, one {# символ} few {# символа} other {# символов}}';
      deepStrictEqual(validator.validate('forms.errors.tooShort', plural, template), [
        { code: 'templateFormat', name: 'min' },
      ]);
      deepStrictEqual(validator.validate('forms.errors.tooShort', plural), [], 'fine in full ICU');
      deepStrictEqual(validator.validate('gallery.counter', '{current} из {total, number}', template), [
        { code: 'templateFormat', name: 'total' },
      ]);
      deepStrictEqual(
        validator.validate('contacts.form.subjectLine', 'Re: {subject, select, other {{subject}}}', template),
        [{ code: 'templateFormat', name: 'subject' }],
      );
    });

    it('rejects tokens the client would not find, repeats and apostrophe quoting', () => {
      deepStrictEqual(validator.validate('forms.errors.tooShort', 'Минимум { min }', template), [
        { code: 'templateToken', token: '{min}' },
      ]);
      for (const value of ['Язык: <lang>{ language }</lang>', 'Переключить язык на <lang>«{language}»</lang>']) {
        deepStrictEqual(validator.validate('common.switchLanguageTo', value, template), [
          { code: 'templateToken', token: '<lang>{language}</lang>' },
        ]);
      }
      deepStrictEqual(validator.validate('contacts.form.subjectLine', 'По поводу: {subject} ({subject})', template), [
        { code: 'templateRepeat', token: '{subject}' },
      ]);
      deepStrictEqual(validator.validate('forms.errors.tooShort', "It''s {min}", template), [
        { code: 'templateQuote' },
      ]);
      deepStrictEqual(validator.validate('forms.errors.tooShort', "Скобка '{' и {min}", template), [
        { code: 'templateQuote' },
      ]);
    });
  });

  describe('trial format (what next-intl does at render time)', () => {
    // Verdicts of next-intl's own formatter for these values (frontend test "refuses exactly the
    // values next-intl cannot format"): a bad currency / unit, currency style without a currency,
    // a date format of a text argument.
    const cases = [
      { key: 'catalog.models', value: '{count, plural, one {# вещь} other {# вещей}}', renders: true },
      { key: 'catalog.models', value: '{count, number, ::currency/USD}', renders: true },
      { key: 'catalog.models', value: '{count, number, ::currency/XY}', renders: false },
      { key: 'catalog.models', value: '{count, number, currency}', renders: false },
      { key: 'catalog.models', value: '{count, number, ::unit/foo}', renders: false },
      {
        key: 'catalog.models',
        value: '{count, plural, one {{count, number, ::unit/foo}} other {# шт.}}',
        renders: false,
      },
      { key: 'catalog.orderSubject', value: 'Заказ: {product, select, other {«{product}»}}', renders: true },
      { key: 'catalog.orderSubject', value: 'Заказ от {product, date}', renders: false },
    ];

    it('refuses exactly the values next-intl cannot format', () => {
      for (const { key, value, renders } of cases) {
        strictEqual(validator.validate(key, value, { locale: Locale.RU }).length === 0, renders, value);
      }
    });

    it('names the broken format', () => {
      const [currency] = validator.validate('catalog.models', 'Модели: {count, number, ::currency/XY}');
      ok(currency.code === MessageIssueCode.FORMAT);
      strictEqual(currency.token, '{count, number, ::currency/XY}');
      ok(/currency/i.test(currency.error));
      const [unit] = validator.validate(
        'catalog.models',
        '{count, plural, one {{count, number, ::unit/foo}} other {# шт.}}',
      );
      ok(unit?.code === MessageIssueCode.FORMAT);
      strictEqual(unit.token, '{count, number, ::unit/foo}');
    });
  });
});
