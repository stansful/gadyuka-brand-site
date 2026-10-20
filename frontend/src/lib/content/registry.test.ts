import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  isLiteralElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  parse,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/locales';
import { parseMessageFormat } from '@/i18n/message-format';
import { DEFAULT_MESSAGES, defaultMessage, flattenMessages, MESSAGE_KEYS } from '@/i18n/messages';

import { SEED_CONTENT_IMAGES } from '../../../prisma/seed-data/media';
import {
  CHAPTER_ORDER,
  CONTENT_IMAGES,
  CONTENT_SECTIONS,
  IMAGE_KEYS,
  isImageKey,
  isMessageKey,
  isRequiredKey,
  messageDefinition,
  messageKind,
  sectionMessageKeys,
} from './registry';

/**
 * The key set of the site copy is messages/ru.json; this registry only adds admin metadata.
 * Checks: every key the site references exists (→ is listed in the admin «Контент» screen),
 * every locale has the same keys with non-empty, parseable defaults, and the metadata (kinds,
 * required flags, sections) is consistent with the JSON.
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
  'src/lib/telegram.ts',
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
const sectionIds = CONTENT_SECTIONS.map(section => section.id).join('|');
/** "about.advantages.0.title" — a quoted string that starts with a section (namespace) id. */
const KEY_LITERAL = new RegExp(`["'\`]((?:${sectionIds})\\.[A-Za-z0-9.]+)["'\`]`, 'g');

/** Branch paths of the message tree ("forms.errors") — valid next-intl namespaces. */
const BRANCHES = new Set(
  MESSAGE_KEYS.flatMap(key => {
    const parts = key.split('.');
    return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join('.'));
  }),
);

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
        const parsed = parseMessageFormat(defaultMessage(key, locale));
        if (!parsed.ok) problems.push(`${key}.${locale}: ${parsed.error}`);
        return parsed.ok ? [...parsed.format.arguments, ...parsed.format.tags.map(tag => `<${tag}>`)].sort() : [];
      });
      if (formats.some(format => format.join() !== formats[0]?.join())) problems.push(`${key}: ${formats.join(' | ')}`);
    }
    expect(problems).toEqual([]);
  });

  it('marks exactly the templates as ICU or simple templates (arguments, plural forms, tags)', () => {
    const icu = MESSAGE_KEYS.filter(key => messageKind(key) === 'icu');
    const simple = MESSAGE_KEYS.filter(key => messageKind(key) === 'template');
    const templates = MESSAGE_KEYS.filter(key => {
      const parsed = parseMessageFormat(defaultMessage(key, 'ru'));
      return parsed.ok && parsed.format.arguments.length + parsed.format.tags.length > 0;
    });
    expect([...icu, ...simple].sort()).toEqual([...templates].sort());
    expect(icu).toEqual(expect.arrayContaining(['catalog.models', 'hero.heading', 'telegram.newLead']));
    // Filled in by the client components (fill / splitTemplate, src/components/site/labels.ts),
    // so the admin may not turn them into plural forms or formats.
    expect(simple).toEqual([
      'gallery.counter', // GalleryScene
      'contacts.form.subjectLine', // LeadForm
      'common.switchLanguageTo', // SiteHeader → LanguageSwitcher
      'forms.errors.tooShort', // LeadForm (and /api/leads)
      'forms.errors.tooLong',
    ]);
    expect(messageKind('catalog.text')).toBe('richtext');
    expect(messageKind('hero.title')).toBe('text');
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
    const ids = CONTENT_SECTIONS.map(section => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(DEFAULT_MESSAGES.ru).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(sectionMessageKeys(id).length, id).toBeGreaterThan(0);
    expect(sectionMessageKeys('about').slice(0, 2)).toEqual(['about.label', 'about.title']);
    // Admin labels are admin copy (messages/admin/ru.json, src/lib/admin/admin-copy.test.ts).
    expect(messageDefinition('about.advantages.0.title')).toMatchObject({
      section: 'about',
      kind: 'text',
      required: false,
      defaults: { ru: 'Авторские модели', en: 'Original designs' },
    });
  });

  it('keeps the landing images apart from the messages, each with a seed image', () => {
    expect(IMAGE_KEYS.filter(key => isMessageKey(key))).toEqual([]);
    expect(Object.keys(SEED_CONTENT_IMAGES).sort()).toEqual([...IMAGE_KEYS].sort());
    for (const key of IMAGE_KEYS) expect(sectionMessageKeys(CONTENT_IMAGES[key].section).length).toBeGreaterThan(0);
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
