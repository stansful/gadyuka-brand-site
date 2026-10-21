import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import type { MessageRef } from '~shared/contracts/errors';

import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { SiteTextKind } from '~core/site-texts/site-text-kind.enum';

import { SiteTextsTestKit } from './test/site-texts-test-kit';

/** Port of the frontend's siteTextValueError tests (src/lib/admin/site-texts.test.ts): keys instead of texts. */
describe('SiteTextValueChecker (what an admin-edited text may be)', () => {
  const kit = new SiteTextsTestKit();
  const argumentsOf = (key: string): readonly string[] => kit.definitions.find(key)?.format.arguments ?? [];
  const plainKey = kit.firstKey(
    key => argumentsOf(key).length === 0 && kit.defaultOf(key, Locale.RU).length > 3,
    'plain text',
  );
  const argumentKey = kit.firstKey(key => argumentsOf(key).length > 0, 'text with an {argument}');
  const requiredKey = kit.firstKey(key => kit.definitions.find(key)?.required === true, 'required text');
  const optionalKey = kit.firstKey(
    key => kit.definitions.find(key)?.required === false && argumentsOf(key).length === 0,
    'optional text',
  );

  function errorOf(key: string, locale: Locale, value: string): MessageRef | undefined {
    const definition = kit.definitions.find(key);
    if (definition === undefined) {
      throw new Error(`no site text ${key}`);
    }
    return kit.values.findError(definition, locale, value);
  }

  it('accepts every default value', () => {
    for (const key of kit.catalog.siteKeys()) {
      for (const locale of LocaleMap.LOCALES) {
        deepStrictEqual(
          { key, locale, error: errorOf(key, locale, kit.defaultOf(key, locale)) },
          { key, locale, error: undefined },
        );
      }
    }
  });

  it('requires the Russian text of required keys only', () => {
    deepStrictEqual(errorOf(requiredKey, Locale.RU, '  '), { key: SiteTextsMessageKey.ERRORS_REQUIRED });
    strictEqual(errorOf(requiredKey, Locale.EN, ''), undefined);
    strictEqual(errorOf(optionalKey, Locale.RU, ''), undefined);
  });

  it('rejects broken ICU syntax and unknown {arguments} / <tags>', () => {
    deepStrictEqual(errorOf(argumentKey, Locale.RU, 'Текст {'), { key: SiteTextsMessageKey.ERRORS_SYNTAX_ARGUMENT });
    deepStrictEqual(errorOf(plainKey, Locale.RU, 'Текст {name}'), {
      key: SiteTextsMessageKey.ERRORS_NO_ARGUMENTS,
      values: { token: '{name}' },
    });
    deepStrictEqual(errorOf(plainKey, Locale.RU, 'Текст <b>жирно</b>'), {
      key: SiteTextsMessageKey.ERRORS_NO_TAGS,
      values: { token: '<b>' },
    });
    deepStrictEqual(errorOf('catalog.models', Locale.RU, '{total} моделей'), {
      key: SiteTextsMessageKey.ERRORS_UNKNOWN_ARGUMENT,
      values: { token: '{total}', allowed: '{count}' },
    });
    deepStrictEqual(errorOf('common.switchLanguageTo', Locale.RU, 'Язык: {language}'), {
      key: SiteTextsMessageKey.ERRORS_MISSING_TAG,
      values: { token: '<lang>…</lang>' },
    });
    deepStrictEqual(errorOf('catalog.models', Locale.RU, 'Модели <b>{count}</b>'), {
      key: SiteTextsMessageKey.ERRORS_NO_TAGS,
      values: { token: '<b>' },
    });
  });

  it('explains the parser errors of tags and plural forms', () => {
    deepStrictEqual(errorOf('common.switchLanguageTo', Locale.RU, 'Язык <lang>{language}'), {
      key: SiteTextsMessageKey.ERRORS_SYNTAX_TAG,
    });
    deepStrictEqual(errorOf('catalog.models', Locale.RU, '{count, plural, one {# модель}}'), {
      key: SiteTextsMessageKey.ERRORS_SYNTAX_OTHER,
    });
    deepStrictEqual(errorOf('catalog.models', Locale.RU, '{count, plural, one {# модель} other}'), {
      key: SiteTextsMessageKey.ERRORS_SYNTAX_PLURAL,
    });
  });

  it('requires the only accessible name of a control and the lead form errors', () => {
    for (const key of ['common.openMenu', 'common.homeLink', 'common.closeViewer', 'forms.sendAnother']) {
      deepStrictEqual(errorOf(key, Locale.RU, ''), { key: SiteTextsMessageKey.ERRORS_REQUIRED }, key);
    }
    deepStrictEqual(errorOf('forms.errors.tooShort', Locale.RU, ' '), { key: SiteTextsMessageKey.ERRORS_REQUIRED });
    strictEqual(errorOf('forms.errors.invalidEmail', Locale.EN, ''), undefined, 'shows the Russian text');
  });

  it('keeps the texts the client fills in to plain {placeholders} (no raw ICU on the site)', () => {
    const plural = 'Слишком коротко — минимум {min, plural, one {# символ} few {# символа} other {# символов}}';
    deepStrictEqual(errorOf('forms.errors.tooShort', Locale.RU, plural), {
      key: SiteTextsMessageKey.ERRORS_TEMPLATE_FORMAT,
      values: { token: '{min}' },
    });
    deepStrictEqual(errorOf('gallery.counter', Locale.RU, '{current} из {total, number}'), {
      key: SiteTextsMessageKey.ERRORS_TEMPLATE_FORMAT,
      values: { token: '{total}' },
    });
    deepStrictEqual(errorOf('common.switchLanguageTo', Locale.RU, 'Язык: <lang>{ language }</lang>'), {
      key: SiteTextsMessageKey.ERRORS_TEMPLATE_TOKEN,
      values: { token: '<lang>{language}</lang>' },
    });
    deepStrictEqual(errorOf('contacts.form.subjectLine', Locale.EN, 'Re: {subject} ({subject})'), {
      key: SiteTextsMessageKey.ERRORS_TEMPLATE_REPEAT,
      values: { token: '{subject}' },
    });
    deepStrictEqual(errorOf('forms.errors.tooLong', Locale.RU, "Max {max} — that''s it"), {
      key: SiteTextsMessageKey.ERRORS_TEMPLATE_QUOTE,
    });
    // the same plural is fine where the server formats the text (next-intl t())
    strictEqual(errorOf('catalog.models', Locale.RU, '{count, plural, one {# вещь} other {# вещей}}'), undefined);
  });

  it('rejects a format the site cannot render (next-intl would show the key instead)', () => {
    deepStrictEqual(errorOf('catalog.models', Locale.RU, '{count, number, ::currency/XY}'), {
      key: SiteTextsMessageKey.ERRORS_FORMAT,
      values: { token: '{count, number, ::currency/XY}' },
    });
    strictEqual(errorOf('catalog.models', Locale.EN, '{count, number, ::currency/USD}'), undefined);
  });

  it('rejects a text that lost an {argument} of its default («из {max}» cannot become «из 5»)', () => {
    const simpleArgument = /\{(\w+)\}/;
    const key = kit.firstKey(key => simpleArgument.test(kit.defaultOf(key, Locale.RU)), 'text with a plain {argument}');
    const lost = simpleArgument.exec(kit.defaultOf(key, Locale.RU))?.[1] ?? '';
    const withoutArgument = kit.defaultOf(key, Locale.RU).replaceAll(`{${lost}}`, '5');
    deepStrictEqual(errorOf(key, Locale.RU, withoutArgument), {
      key: SiteTextsMessageKey.ERRORS_MISSING_ARGUMENT,
      values: { token: `{${lost}}` },
    });
    strictEqual(errorOf(key, Locale.RU, `${kit.defaultOf(key, Locale.RU)} — и ещё`), undefined);
  });

  it('accepts only site links for a link text (none is configured today: the rule of the entity forms)', () => {
    const definition = kit.definitions.find('footer.top');
    ok(definition !== undefined);
    const link = { ...definition, kind: SiteTextKind.LINK };
    for (const href of ['https://t.me/x', '/catalog', '#about', 'mailto:a@b.ru', 'tel:+7 900 000-00-00']) {
      strictEqual(kit.values.findError(link, Locale.RU, href), undefined, href);
    }
    for (const href of ['javascript:alert(1)', '//evil.example', 'catalog', `/${'x'.repeat(500)}`]) {
      deepStrictEqual(kit.values.findError(link, Locale.RU, href), { key: SiteTextsMessageKey.ERRORS_LINK }, href);
    }
  });
});

describe('SiteTextLabels (what the search matches besides the texts)', () => {
  const kit = new SiteTextsTestKit();

  it('names texts from admin.siteTexts.labels (ICU-formatted), unlabeled ones by the key without the namespace', () => {
    strictEqual(kit.labels.labelOf('about.advantages.0.title'), 'Преимущество 1: заголовок');
    // ICU-escaped in the JSON: the label shows the placeholder literally.
    strictEqual(kit.labels.labelOf('catalog.collectionTitle'), 'Название коллекции в кавычках ({title} — название)');
    strictEqual(kit.labels.labelOf('zzzNew.some.key'), 'some.key');
  });

  it('formats the label of every text', () => {
    for (const key of kit.catalog.siteKeys()) {
      ok(kit.labels.labelOf(key).length > 0, key);
    }
  });
});
