import { IntlMessageFormat } from 'intl-messageformat';
import { createElement, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { locales } from '@/i18n/locales';
import { validateMessageValue } from '@/i18n/message-format';
import { DEFAULT_MESSAGES, MESSAGE_KEYS, defaultMessage, type MessageKey } from '@/i18n/messages';
import { messageKind } from '@/lib/content/registry';

import { fill, splitLanguageTemplate, splitTemplate } from './labels';
import { formatNodes, formatText } from './message-template';

/** The text a rendered template would show (elements stand for their children). */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

describe('message templates (server components)', () => {
  it('fills the templates of the site messages', () => {
    expect(formatText(DEFAULT_MESSAGES.ru.common.chapterNo, 'ru', { number: '02' })).toBe('Глава 02');
    expect(formatText(DEFAULT_MESSAGES.en.catalog.productNo, 'en', { number: '01' })).toBe('#01');
    // years stay unformatted (no «2 026»)
    expect(formatText(DEFAULT_MESSAGES.ru.footer.copyright, 'ru', { year: '2026' })).toBe(
      DEFAULT_MESSAGES.ru.footer.copyright.replace('{year}', '2026'),
    );
    expect(formatText('{count, plural, one {# модель} few {# модели} other {# моделей}}', 'ru', { count: 3 })).toBe(
      '3 модели',
    );
  });

  it('keeps React nodes (edit hooks, <time>) as arguments', () => {
    const label = createElement('span', { 'data-edit': 'about.label' }, 'О нас');
    const parts = formatNodes(DEFAULT_MESSAGES.ru.common.chapterLabel, 'ru', { chapter: 'Глава 02', label });
    expect(textOf(parts)).toBe('Глава 02 · О нас');
    expect(Array.isArray(parts)).toBe(true);
    expect(formatNodes('{a}', 'ru', { a: 'x' })).toBe('x');
  });

  it('follows an admin edit of the word order and punctuation', () => {
    const date = createElement('time', { dateTime: '2026-12-31' }, '31 декабря 2026');
    expect(textOf(formatNodes('До {date} включительно', 'ru', { date }))).toBe('До 31 декабря 2026 включительно');
  });

  it('never throws on a broken value: the raw text is shown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(formatText('Глава {number', 'ru', { number: '01' })).toBe('Глава {number');
    expect(formatText('{a} {b}', 'ru', { a: '1' })).toBe('{a} {b}');
    warn.mockRestore();
  });
});

describe('client templates (simple placeholders)', () => {
  it('splits a template around the inserted part', () => {
    expect(splitTemplate(DEFAULT_MESSAGES.ru.contacts.form.subjectLine, '{subject}')).toEqual({
      before: DEFAULT_MESSAGES.ru.contacts.form.subjectLine.replace('{subject}', ''),
      after: '',
    });
    expect(splitTemplate('{subject} — тема', '{subject}')).toEqual({ before: '', after: ' — тема' });
    expect(splitTemplate('Тема', '{subject}')).toEqual({ before: 'Тема', after: '' });
    expect(splitLanguageTemplate('Switch language to <lang>{language}</lang>')).toEqual({
      before: 'Switch language to ',
      after: '',
    });
  });
});

/**
 * The "template" texts as the client components render them (fill / splitTemplate) next to
 * what ICU makes of the same value — the inserted part in [brackets].
 */
type ClientTemplate = {
  values: Readonly<Record<string, string | number>>;
  client: (template: string) => string;
};

function around({ before, after }: { before: string; after: string }, inserted: string): string {
  return `${before}[${inserted}]${after}`;
}

const CLIENT_TEMPLATES: Readonly<Partial<Record<MessageKey, ClientTemplate>>> = {
  'gallery.counter': {
    values: { current: '03', total: '12' },
    client: template => fill(template, { current: '03', total: '12' }),
  },
  'forms.errors.tooShort': { values: { min: 2 }, client: template => fill(template, { min: 2 }) },
  'forms.errors.tooLong': { values: { max: 254 }, client: template => fill(template, { max: 254 }) },
  'contacts.form.subjectLine': {
    values: { subject: '[Худи «Яд»]' },
    client: template => around(splitTemplate(template, '{subject}'), 'Худи «Яд»'),
  },
  'common.switchLanguageTo': {
    values: { language: 'English' },
    client: template => around(splitLanguageTemplate(template), 'English'),
  },
};

/** Edits an owner might try; the admin accepts some of them (syntax "template"). */
const EDITS: Readonly<Partial<Record<MessageKey, readonly string[]>>> = {
  'gallery.counter': ['Фото {current} из {total}', '{current} из {total, number}', '{ current } / {total}'],
  'forms.errors.tooShort': [
    'Минимум символов: {min}',
    'Слишком коротко — минимум {min, plural, one {# символ} few {# символа} other {# символов}}',
    "It''s {min}",
  ],
  'forms.errors.tooLong': ['Не больше {max} знаков', 'максимум {max, number, ::currency/XY}'],
  'contacts.form.subjectLine': ['{subject} — тема', 'Re: {subject} ({subject})', 'Re: {subject, select, other {x}}'],
  'common.switchLanguageTo': [
    'Язык: <lang>{language}</lang>!',
    'Язык: <lang>{ language }</lang>',
    'Переключить язык на <lang>«{language}»</lang>',
  ],
};

describe('"template" texts (filled in by the client components)', () => {
  it('are exactly the texts the client helpers fill in', () => {
    expect(MESSAGE_KEYS.filter(key => messageKind(key) === 'template').sort()).toEqual(
      Object.keys(CLIENT_TEMPLATES).sort(),
    );
  });

  it('render every value the admin accepts exactly like ICU', () => {
    const differ: string[] = [];
    let accepted = 0;
    for (const [key, template] of Object.entries(CLIENT_TEMPLATES) as Array<[MessageKey, ClientTemplate]>) {
      const values = [...locales.map(locale => defaultMessage(key, locale)), ...(EDITS[key] ?? [])];
      for (const value of values) {
        if (validateMessageValue(key, value, { syntax: 'template' }).length > 0) continue;
        accepted += 1;
        const icu = new IntlMessageFormat(value, 'ru-RU').format<string>({
          ...template.values,
          lang: (chunks: ReadonlyArray<string>) => `[${chunks.join('')}]`,
        });
        if (template.client(value) !== icu) differ.push(`${key}: «${value}»`);
      }
    }
    expect(differ).toEqual([]);
    expect(accepted).toBeGreaterThan(10);
  });

  it('refuses the edits the client helpers would show raw', () => {
    const shownRaw = Object.entries(EDITS).flatMap(([key, values]) =>
      (values ?? []).filter(value => {
        const template = CLIENT_TEMPLATES[key as MessageKey];
        return template !== undefined && /[{}<>']/.test(template.client(value).replace(/\[[^\]]*\]/g, ''));
      }),
    );
    expect(shownRaw.length).toBeGreaterThan(5);
    for (const [key, values] of Object.entries(EDITS)) {
      for (const value of values ?? []) {
        if (!shownRaw.includes(value)) continue;
        expect(validateMessageValue(key as MessageKey, value, { syntax: 'template' }), value).not.toEqual([]);
      }
    }
  });
});
