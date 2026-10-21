import { describe, expect, it } from 'vitest';

import { errorLocales, errorsByEntryKey } from './content-errors';

const keys = ['hero.title', 'forms.errors.tooShort'];
const imageKeys = ['about.image'];

describe('errorsByEntryKey', () => {
  it('re-keys the shape errors of the backend from entry / image indexes to message and image keys (+ locale)', () => {
    expect(
      errorsByEntryKey(
        {
          'entries.0.values.en': 'Не длиннее 10000 символов',
          'entries.1.key': 'Не указан ключ',
          'images.0.mediaId': 'Некорректный идентификатор',
          entries: 'Тексты повторяются',
        },
        keys,
        imageKeys,
      ),
    ).toEqual({
      'hero.title.en': 'Не длиннее 10000 символов',
      'forms.errors.tooShort': 'Не указан ключ',
      'about.image': 'Некорректный идентификатор',
      entries: 'Тексты повторяются',
    });
  });

  it('re-keys errors of one language of a sent text ("entries.<i>.values.<locale>.value")', () => {
    expect(
      errorsByEntryKey(
        { 'entries.1.values.en.value': 'Не длиннее 10000 символов', 'entries.0.values.ru.base': 'x' },
        keys,
      ),
    ).toEqual({ 'forms.errors.tooShort.en': 'Не длиннее 10000 символов', 'hero.title.ru': 'x' });
  });

  it('keeps errors the action already keyed by message key', () => {
    expect(errorsByEntryKey({ 'hero.title.ru': 'Обязательный текст' }, keys)).toEqual({
      'hero.title.ru': 'Обязательный текст',
    });
  });

  it('never loses an error with an unknown or region-tagged suffix (falls back to the text)', () => {
    expect(errorsByEntryKey({ 'entries.0.values.pt-br': 'Ошибка' }, keys)).toEqual({ 'hero.title': 'Ошибка' });
    expect(errorLocales({ 'hero.title': 'Ошибка' }, keys)).toEqual(new Set(['ru']));
  });

  it('drops errors of indexes the view does not have', () => {
    expect(errorsByEntryKey({ 'entries.7.values.ru': 'x', 'images.3.mediaId': 'y' }, keys, imageKeys)).toEqual({});
  });

  it('marks the language tab of each error (dotted keys included)', () => {
    expect(errorLocales({ 'forms.errors.tooShort.en': 'x', 'about.image': 'y' }, [...keys, ...imageKeys])).toEqual(
      new Set(['en', 'ru']),
    );
  });
});
