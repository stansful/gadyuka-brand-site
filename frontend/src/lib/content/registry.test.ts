import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  isArgumentElement,
  isDateElement,
  isLiteralElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/locales';
import { DEFAULT_MESSAGES, defaultMessage, flattenMessages, MESSAGE_KEYS } from '@/i18n/messages';

import {
  isRequiredKey,
  kindOverride,
  METADATA_KEYS,
  SITE_TEXT_SECTIONS,
  sectionMessageKeys,
} from '../../../test/site-text-metadata';
import { CHAPTER_ORDER, CONTENT_IMAGES, IMAGE_KEYS, isImageKey, isMessageKey, isSectionId } from './registry';

/**
 * The key set of the site copy is shared/messages/ru.json; shared/messages/meta/site-texts.json adds
 * the metadata the backend validates admin edits with. Checks: every key the site references exists
 * (→ is listed in the admin «Тексты сайта»), every locale has the same keys with non-empty, parseable
 * defaults, and the metadata (sections, kinds, required flags, images) fits the JSON and the site.
 */

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SITE_SOURCES = [
  'src/components/site',
  'src/app/[locale]',
  'src/app/manifest.ts',
  'src/app/api/leads',
  'src/lib/leads.ts',
  'src/lib/lead-form-config.ts',
  'src/lib/seo',
];

function filesUnder(relative: string): string[] {
  const absolute = path.join(ROOT, relative);
  if (statSync(absolute).isFile()) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return filesUnder(child);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path.join(ROOT, child)] : [];
  });
}

const sources = SITE_SOURCES.flatMap(filesUnder).map(file => ({
  file: path.relative(ROOT, file),
  text: readFileSync(file, 'utf8'),
}));
const sectionIds = Object.keys(DEFAULT_MESSAGES.ru).join('|');
/** "about.advantages.0.title" — a quoted string that starts with a section (namespace) id. */
const KEY_LITERAL = new RegExp(`["'\`]((?:${sectionIds})\\.[A-Za-z0-9.]+)["'\`]`, 'g');

/** Branch paths of the message tree ("forms.errors") — valid next-intl namespaces. */
const BRANCHES = new Set(
  MESSAGE_KEYS.flatMap(key => {
    const parts = key.split('.');
    return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join('.'));
  }),
);

/** {arguments} and <tags> of a message, sorted ("<lang>", "language"); null when it is not valid ICU. */
function formatOf(value: string): string[] | null {
  const found = new Set<string>();
  const walk = (elements: readonly MessageFormatElement[]): void => {
    for (const element of elements) {
      if (isArgumentElement(element) || isNumberElement(element) || isDateElement(element) || isTimeElement(element))
        found.add(element.value);
      if (isPluralElement(element) || isSelectElement(element)) {
        found.add(element.value);
        for (const option of Object.values(element.options)) walk(option.value);
      }
      if (isTagElement(element)) {
        found.add(`<${element.value}>`);
        walk(element.children);
      }
    }
  };
  try {
    walk(parse(value));
  } catch {
    return null;
  }
  return [...found].sort();
}

/** The literal (non-ICU) text of a message: what a reader sees, without {arguments} and plural selectors. */
function literalText(value: string): string {
  const walk = (elements: readonly MessageFormatElement[]): string =>
    elements
      .map(element => {
        if (isLiteralElement(element)) return element.value;
        if (isPluralElement(element) || isSelectElement(element))
          return Object.values(element.options)
            .map(option => walk(option.value))
            .join(' ');
        if (isTagElement(element)) return walk(element.children);
        return ' ';
      })
      .join('');
  return walk(parse(value));
}

describe('content registry ↔ messages ↔ site', () => {
  it('knows every message key the site references (data-edit, texts[…], namespaces)', () => {
    const unknown: string[] = [];
    const seen = new Set<string>();
    for (const { file, text } of sources) {
      for (const match of text.matchAll(KEY_LITERAL)) {
        const key = match[1] ?? '';
        seen.add(key);
        if (!isMessageKey(key) && !isImageKey(key) && !BRANCHES.has(key)) unknown.push(`${file}: ${key}`);
      }
    }
    expect(unknown).toEqual([]);
    expect(seen.size).toBeGreaterThan(80); // the scan really sees the site's keys
  });

  it('has the same keys in every locale, each with a non-empty default', () => {
    const reference = Object.keys(flattenMessages(DEFAULT_MESSAGES.ru)).sort();
    for (const locale of locales) {
      expect(Object.keys(flattenMessages(DEFAULT_MESSAGES[locale])).sort(), locale).toEqual(reference);
    }
    const empty = MESSAGE_KEYS.flatMap(key =>
      locales.filter(locale => defaultMessage(key, locale).trim() === '').map(locale => `${key}.${locale}`),
    );
    expect(empty).toEqual([]);
  });

  it('keeps every default valid ICU, with the same arguments and tags in every locale', () => {
    const problems: string[] = [];
    for (const key of MESSAGE_KEYS) {
      const formats = locales.map(locale => {
        const format = formatOf(defaultMessage(key, locale));
        if (!format) problems.push(`${key}.${locale}: not valid ICU`);
        return format ?? [];
      });
      if (formats.some(format => format.join() !== formats[0]?.join())) problems.push(`${key}: ${formats.join(' | ')}`);
    }
    expect(problems).toEqual([]);
  });

  it('has metadata only for real keys, with kinds the site knows', () => {
    expect(METADATA_KEYS.filter(key => !isMessageKey(key))).toEqual([]);
    const kinds = new Set(MESSAGE_KEYS.map(kindOverride));
    expect([...kinds].filter(kind => kind !== undefined && !['richtext', 'template', 'link'].includes(kind))).toEqual(
      [],
    );
    // the texts the client components fill in: src/components/site/message-template.test.ts
    expect(kindOverride('catalog.text')).toBe('richtext');
    expect(kindOverride('hero.title')).toBeUndefined();
  });

  it('requires the headings and the buttons (never saved empty in the admin)', () => {
    for (const chapter of CHAPTER_ORDER) expect(isRequiredKey(`${chapter}.title`), chapter).toBe(true);
    expect(isRequiredKey('hero.title')).toBe(true);
    expect(isRequiredKey('header.cta')).toBe(true);
    expect(isRequiredKey('about.partnersCta')).toBe(true); // a button whose only other content is an aria-hidden arrow
    expect(isRequiredKey('offers.fine')).toBe(false); // «пусто — не показывать»
    expect(isRequiredKey('footer.trademark')).toBe(false);
    expect(MESSAGE_KEYS.filter(key => key.startsWith('social.')).every(isRequiredKey)).toBe(true);
    // the contact form never loses a label, the brand never its name, the owner never a word
    expect(isRequiredKey('contacts.form.submit')).toBe(true);
    expect(isRequiredKey('contacts.form.topics.contact')).toBe(true);
    expect(isRequiredKey('brand.name')).toBe(true);
    expect(isRequiredKey('hero.heading')).toBe(true);
    expect(MESSAGE_KEYS.filter(key => key.startsWith('telegram.')).every(isRequiredKey)).toBe(true);
    // the only accessible name of a control (glyph / icon buttons, the logo link), of a dialog
    // or of a navigation landmark — an aria-label="" would leave it unnamed
    const accessibleNames = [
      'common.homeLink',
      'common.openMenu',
      'common.closeMenu',
      'common.mainNavigation',
      'common.mobileMenu',
      'common.languageSwitcher',
      'common.footerNavigation',
      'common.breadcrumbs',
      'common.imageViewer',
      'common.previousImage',
      'common.nextImage',
      'common.closeViewer',
      'forms.sendAnother', // its only other content is an aria-hidden arrow
      'forms.sending', // the submit button's face while sending
    ] as const;
    for (const key of accessibleNames) expect(isRequiredKey(key), key).toBe(true);
    // the lead form never shows an empty error
    expect(MESSAGE_KEYS.filter(key => key.startsWith('forms.errors.')).every(isRequiredKey)).toBe(true);
    expect(isRequiredKey('forms.noscriptInvalid')).toBe(true);
    expect(isRequiredKey('forms.contactHint')).toBe(false); // an optional hint
  });

  it('lists every namespace as an admin section, in a stable order', () => {
    const ids = SITE_TEXT_SECTIONS;
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(DEFAULT_MESSAGES.ru).sort()).toEqual([...ids].sort());
    expect(ids.every(isSectionId)).toBe(true);
    for (const id of ids) expect(sectionMessageKeys(id).length, id).toBeGreaterThan(0);
    expect(sectionMessageKeys('about').slice(0, 2)).toEqual(['about.label', 'about.title']);
    // Admin labels are admin copy (shared/messages/admin/ru.json, src/lib/admin/admin-copy.test.ts).
  });

  // Each landing image has a seed image: checked by the backend (cli/seed, SEED_CONTENT_IMAGES).
  it('keeps the landing images apart from the messages', () => {
    expect(IMAGE_KEYS.filter(key => isMessageKey(key))).toEqual([]);
    for (const key of IMAGE_KEYS) expect(sectionMessageKeys(CONTENT_IMAGES[key]).length).toBeGreaterThan(0);
    expect(IMAGE_KEYS).toEqual(['about.image', 'tailoring.image']);
  });

  it('never leaves English placeholders in the Russian copy or Russian in the English copy', () => {
    // Allowed in English: the logo word ГАДЮКА and the letter «Г» of the logo (proper names).
    const cyrillicInEn = MESSAGE_KEYS.filter(key =>
      /[А-Яа-яЁё]/.test(literalText(defaultMessage(key, 'en')).replace(/ГАДЮКА|«Г»/g, '')),
    );
    expect(cyrillicInEn).toEqual([]);
    // Allowed in Russian: E-mail, brand-neutral examples like you@mail.ru, phone formats, the
    // names of the social networks (social.*: Telegram, WhatsApp …) and, in the owner's Telegram
    // statuses, the settings they name (TELEGRAM_DRY_RUN=1, .env).
    const latinInRu = MESSAGE_KEYS.filter(
      key =>
        !key.startsWith('social.') &&
        /[A-Za-z]{3,}/.test(
          literalText(defaultMessage(key, 'ru')).replace(
            /e-mail|[\w.]+@[\w.]+|\bTelegram\b|\bTELEGRAM_\w+|\.env\b/gi,
            '',
          ),
        ),
    );
    expect(latinInRu).toEqual([]);
  });
});
