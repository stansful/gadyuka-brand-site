import { defaultLocale, locales, mapLocales, type Locale } from '@/i18n/locales';
import {
  defaultMessageFormat,
  parseMessageFormat,
  validateMessageValue,
  type MessageValueIssue,
} from '@/i18n/message-format';
import { defaultMessageTranslations, messageNamespace, type MessageKey } from '@/i18n/messages';
import {
  CONTENT_IMAGES,
  CONTENT_SECTIONS,
  IMAGE_KEYS,
  SECTION_ANCHORS,
  isRequiredKey,
  isSectionId,
  messageKind,
  type ImageKey,
} from '@/lib/content/registry';

import type { AdminTranslator } from './i18n';
import type { SiteTextEntry, SiteTextSectionSummary } from './types';

import { siteHrefSchema } from './schemas';

/**
 * «Тексты сайта» — the admin side of the site messages (pure, no DB; unit-tested).
 *
 * The key set is messages/ru.json (via @/i18n/messages); each key has one `Message` row per
 * locale. The editor shows what the site shows: the row value, or the JSON default while a row
 * is missing. `Message.editedAt` is the «изменено» marker:
 * - editedAt = null → the text is the default (the seed may update it to a newer default);
 * - editedAt set    → edited in the admin (the seed leaves it alone unless SEED_OVERWRITE=1).
 * Saving a value equal to the default — or «Вернуть по умолчанию» — stores the default with
 * editedAt = null, so the marker always means «differs from messages/<locale>.json».
 */

/** Namespace of the admin UI strings (messages/admin/*.json): never a site text. */
const ADMIN_NAMESPACE = 'admin';

function hasOwn<T extends object>(record: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(record, key);
}

// ── labels ────────────────────────────────────────────────────────────────────

/**
 * Russian admin names of the sections, texts and landing images — admin.siteTexts.sections /
 * labels / images in messages/admin/ru.json (the registry keeps only kinds and required flags).
 */
export type SiteTextLabels = {
  /** A section the admin copy does not name yet is listed under its id. */
  section: (id: string) => string;
  /** A text without a label is listed under its key without the namespace ("advantages.0.title"). */
  text: (key: MessageKey) => string;
  image: (key: ImageKey) => string;
};

type SiteTextsTranslator = AdminTranslator<'admin.siteTexts'>;
type SiteTextsMessageKey = Parameters<SiteTextsTranslator>[0];

export function siteTextLabels(t: SiteTextsTranslator): SiteTextLabels {
  return {
    // Typed per section id: a section of the registry without admin.siteTexts.sections.<id> fails tsc.
    section: id => (isSectionId(id) ? t(`sections.${id}`) : id),
    text: key => {
      // Labels are optional; t.has is the runtime check, the cast only lets it ask.
      const path = `labels.${key}` as SiteTextsMessageKey;
      return t.has(path) ? t(path) : key.slice(key.indexOf('.') + 1);
    },
    image: key => t(`images.${key}`),
  };
}

// ── sections ──────────────────────────────────────────────────────────────────

export type SiteTextSection = { id: string; label: string };

/** Section (top-level namespace) of a key: "forms.errors.required" → "forms". */
export function siteTextSectionOf(key: MessageKey): string {
  return messageNamespace(key);
}

/**
 * Sections of the editor for `keys`: the registry's sections in the registry's order (Russian
 * labels), then any namespace the registry does not know yet (listed by its id, in key order).
 * Sections without keys and the admin namespace are left out.
 */
export function siteTextSections(keys: readonly MessageKey[], labels: SiteTextLabels): SiteTextSection[] {
  const present = new Set<string>();
  const extra: string[] = [];
  for (const key of keys) {
    const section = siteTextSectionOf(key);
    if (section === ADMIN_NAMESPACE || present.has(section)) continue;
    present.add(section);
    if (!CONTENT_SECTIONS.some(item => item.id === section)) extra.push(section);
  }
  return [
    ...CONTENT_SECTIONS.filter(item => present.has(item.id)).map(item => ({
      id: item.id,
      label: labels.section(item.id),
    })),
    ...extra.map(id => ({ id, label: labels.section(id) })),
  ];
}

/** In-page anchor of a section on the landing ("hero" → "home"); null when it has none. */
export function siteTextSectionAnchor(section: string): string | null {
  return hasOwn(SECTION_ANCHORS, section) ? SECTION_ANCHORS[section] : null;
}

/** Landing images (ContentImage keys) shown with the texts of `section`. */
export function siteImageKeysOf(section: string): ImageKey[] {
  return IMAGE_KEYS.filter(key => CONTENT_IMAGES[key].section === section);
}

// ── entries ───────────────────────────────────────────────────────────────────

/** A `Message` row as the admin reads it. */
export type StoredMessage = {
  readonly key: string;
  readonly locale: string;
  readonly value: string;
  readonly editedAt: Date | null;
};

/** "hero.title" + "en" → map key. */
function rowId(key: string, locale: string): string {
  return `${locale}\u0000${key}`;
}

export function indexMessages(rows: ReadonlyArray<StoredMessage>): Map<string, StoredMessage> {
  return new Map(rows.map(row => [rowId(row.key, row.locale), row]));
}

/** Editor entries of `keys` from the stored rows (rows of other keys / locales are ignored). */
export function buildSiteTextEntries(
  keys: readonly MessageKey[],
  rows: ReadonlyArray<StoredMessage>,
  labels: SiteTextLabels,
): SiteTextEntry[] {
  const byId = indexMessages(rows);
  return keys
    .filter(key => siteTextSectionOf(key) !== ADMIN_NAMESPACE)
    .map(key => {
      const defaults = defaultMessageTranslations(key);
      const format = defaultMessageFormat(key);
      const edited: Partial<Record<Locale, string>> = {};
      const missing: Locale[] = [];
      const values = mapLocales(locale => {
        const row = byId.get(rowId(key, locale));
        if (!row) {
          missing.push(locale);
          return defaults[locale];
        }
        if (row.editedAt) edited[locale] = row.editedAt.toISOString();
        return row.value;
      });
      return {
        key,
        label: labels.text(key),
        kind: messageKind(key),
        required: isRequiredKey(key),
        values,
        defaults,
        edited,
        missing,
        placeholders: [...format.arguments],
        tags: [...format.tags],
      };
    });
}

/**
 * Translation gap: the Russian text is filled in but a translation is empty — the site shows
 * the Russian text in that language (same rule as the language tabs' counters).
 */
export function hasTranslationGap(entry: Pick<SiteTextEntry, 'values'>): boolean {
  if (entry.values[defaultLocale].trim() === '') return false;
  return locales.some(locale => locale !== defaultLocale && entry.values[locale].trim() === '');
}

export function isEditedEntry(entry: Pick<SiteTextEntry, 'edited'>): boolean {
  return Object.keys(entry.edited).length > 0;
}

/** Per-section counters of the section tabs (sections in `sections` order). */
export function summarizeSiteTextSections(
  sections: readonly SiteTextSection[],
  entries: readonly SiteTextEntry[],
): SiteTextSectionSummary[] {
  return sections.map(section => {
    const own = entries.filter(entry => siteTextSectionOf(entry.key) === section.id);
    return {
      id: section.id,
      label: section.label,
      total: own.length,
      edited: own.filter(isEditedEntry).length,
      gaps: own.filter(hasTranslationGap).length,
      unsaved: own.filter(entry => entry.missing.length > 0).length,
    };
  });
}

// ── search ────────────────────────────────────────────────────────────────────

/** Max length of the «Тексты сайта» search query. */
export const SITE_TEXT_QUERY_MAX_LENGTH = 100;

/** Lower case, «ё» = «е» (any diaeresis is dropped: NFD + U+0308), collapsed spaces. */
function foldText(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .normalize('NFD')
    .replace(/\u0308/g, '')
    .normalize('NFC')
    .replace(/\s+/g, ' ');
}

/** The query as typed, trimmed and capped ("" = no search). */
export function normalizeSiteTextQuery(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, SITE_TEXT_QUERY_MAX_LENGTH);
}

/**
 * Case-insensitive («ё» = «е») match of `query` in the key, the admin label, or the current or
 * default value in any locale.
 */
export function matchesSiteTextQuery(entry: SiteTextEntry, query: string): boolean {
  const needle = foldText(normalizeSiteTextQuery(query));
  if (needle === '') return true;
  const haystack = [
    entry.key,
    entry.label,
    ...locales.map(locale => entry.values[locale]),
    ...locales.map(locale => entry.defaults[locale]),
  ];
  return haystack.some(text => foldText(text).includes(needle));
}

// ── validation ────────────────────────────────────────────────────────────────

/** A message of admin.siteTexts.errors with its ICU arguments ({token}, {allowed}). */
export type SiteTextError = {
  key: Parameters<AdminTranslator<'admin.siteTexts.errors'>>[0];
  values?: { token: string; allowed?: string };
};

/** The text of a SiteTextError. */
export function siteTextErrorMessage(error: SiteTextError, t: AdminTranslator<'admin.siteTexts.errors'>): string {
  return t(error.key, error.values);
}

/** Parser error kinds (@formatjs/icu-messageformat-parser ErrorKind) → the explanation. */
function syntaxError(error: string): SiteTextError {
  if (/TAG/.test(error)) return { key: 'syntaxTag' };
  if (/OTHER_CLAUSE/.test(error)) return { key: 'syntaxOther' };
  if (/PLURAL|SELECT|SELECTOR|OFFSET/.test(error)) return { key: 'syntaxPlural' };
  return { key: 'syntaxArgument' };
}

const argumentToken = (name: string): string => `{${name}}`;
const tagToken = (name: string): string => `<${name}>`;

/** The explanation of an ICU issue of `key` (validateMessageValue). */
export function messageIssueError(issue: MessageValueIssue, key: MessageKey): SiteTextError {
  const allowed = defaultMessageFormat(key);
  switch (issue.code) {
    case 'syntax':
      return syntaxError(issue.error);
    case 'unknownArgument':
      return allowed.arguments.length > 0
        ? {
            key: 'unknownArgument',
            values: { token: argumentToken(issue.name), allowed: allowed.arguments.map(argumentToken).join(', ') },
          }
        : { key: 'noArguments', values: { token: argumentToken(issue.name) } };
    case 'unknownTag':
      return allowed.tags.length > 0
        ? { key: 'unknownTag', values: { token: tagToken(issue.name), allowed: allowed.tags.map(tagToken).join(', ') } }
        : { key: 'noTags', values: { token: tagToken(issue.name) } };
    case 'missingTag':
      return { key: 'missingTag', values: { token: `<${issue.name}>…</${issue.name}>` } };
    case 'templateFormat':
      return { key: 'templateFormat', values: { token: argumentToken(issue.name) } };
    case 'templateToken':
      return { key: 'templateToken', values: { token: issue.token } };
    case 'templateRepeat':
      return { key: 'templateRepeat', values: { token: issue.token } };
    case 'templateQuote':
      return { key: 'templateQuote' };
    case 'format':
      return { key: 'format', values: { token: issue.token } };
  }
}

/**
 * Arguments of the default of `locale` that `value` lost. Every argument of the default is
 * filled in by the code (e.g. «Оценка {rating} из {max}»), so a text without one would show
 * incomplete information. Compared per locale: a default may legitimately use fewer
 * arguments in one language.
 */
function missingArguments(key: MessageKey, locale: Locale, value: string): string[] {
  const own = parseMessageFormat(defaultMessageTranslations(key)[locale]);
  const edited = parseMessageFormat(value);
  if (!own.ok || !edited.ok) return [];
  return own.format.arguments.filter(name => !edited.format.arguments.includes(name));
}

/**
 * Why `value` cannot be saved as the `locale` text of `key` (null = fine):
 * - required keys need a Russian text (other languages may be empty: they show Russian);
 * - "link" texts must be a site link (the siteHrefSchema rules of the entity forms);
 * - the value must be valid ICU, use exactly the {arguments} and <tags> of the default and
 *   format without errors; a "template" text (filled in by the site's client code) may only
 *   use them as plain {name} placeholders and the default's tags, each once.
 */
export function siteTextValueError(key: MessageKey, locale: Locale, value: string): SiteTextError | null {
  const text = value.trim();
  if (text === '') return locale === defaultLocale && isRequiredKey(key) ? { key: 'required' } : null;
  const kind = messageKind(key);
  if (kind === 'link' && !siteHrefSchema.safeParse(text).success) return { key: 'link' };
  const syntax = kind === 'template' ? 'template' : 'icu';
  const issue = validateMessageValue(key, text, { syntax, locale })[0];
  if (issue) return messageIssueError(issue, key);
  const lost = missingArguments(key, locale, text)[0];
  if (lost !== undefined) return { key: 'missingArgument', values: { token: argumentToken(lost) } };
  return null;
}

// ── writes ────────────────────────────────────────────────────────────────────

/** One Message upsert: `editedAt` null = the value is the default. */
export type SiteTextWrite = { key: MessageKey; locale: Locale; value: string; editedAt: Date | null };

/**
 * The Message writes that store `entries` (only what actually changes):
 * - a value equal to the locale's default is stored with editedAt = null («по умолчанию»);
 * - any other value is stored with editedAt = `now` («изменено»);
 * - an existing row with the same value and the same default/edited state is not touched,
 *   so saving a section never marks untouched texts as edited.
 * A locale missing from `values` is skipped. Values must be validated (and trimmed) already.
 */
export function planSiteTextWrites(
  entries: ReadonlyArray<{ key: MessageKey; values: Partial<Record<Locale, string>> }>,
  rows: ReadonlyArray<StoredMessage>,
  now: Date,
): SiteTextWrite[] {
  const byId = indexMessages(rows);
  const writes: SiteTextWrite[] = [];
  for (const entry of entries) {
    const defaults = defaultMessageTranslations(entry.key);
    for (const locale of locales) {
      const value = entry.values[locale];
      if (value === undefined) continue;
      const isDefault = value === defaults[locale];
      const row = byId.get(rowId(entry.key, locale));
      if (row && row.value === value && (row.editedAt === null) === isDefault) continue;
      writes.push({ key: entry.key, locale, value, editedAt: isDefault ? null : now });
    }
  }
  return writes;
}

/** «Вернуть по умолчанию»: the default of every locale, editedAt = null. */
export function resetSiteTextWrites(key: MessageKey): SiteTextWrite[] {
  const defaults = defaultMessageTranslations(key);
  return locales.map(locale => ({ key, locale, value: defaults[locale], editedAt: null }));
}
