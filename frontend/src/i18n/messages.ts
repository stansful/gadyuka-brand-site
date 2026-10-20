import en from '../../messages/en.json';
import ru from '../../messages/ru.json';
import { defaultLocale, mapLocales, type Locale } from './locales';

/**
 * Site UI messages — the static side (ISOMORPHIC and pure: no DB, no server-only imports).
 *
 * messages/<locale>.json holds the DEFAULT value of every site UI string and is the single
 * source of the key set: the seed writes every leaf into the `Message` table (key = dotted
 * path, e.g. "hero.title", "about.advantages.0.title"), the admin edits those rows, and the
 * site renders the DB value overlaid on these defaults (./site-messages.ts, server-only), so
 * a missing row never breaks a page.
 *
 * Not in here: the admin UI strings (messages/admin/*.json — the "admin" namespace, loaded by
 * ./request.ts, never seeded or editable) and the demo entity copy used by the seed only
 * (messages/content/*.json).
 */

/** The site message tree: the shape of messages/ru.json (every locale file has the same shape). */
export type SiteMessages = typeof ru;

/** Top-level namespace of the site messages ("hero", "forms", …) — an admin «Контент» section. */
export type MessageNamespace = keyof SiteMessages & string;

/** Any nested message tree: branches are objects, leaves are strings. */
export type MessageTree = { readonly [key: string]: string | MessageTree };

type MutableMessageTree = { [key: string]: string | MutableMessageTree };

/** Dotted paths of the string leaves of T: "hero.title", "about.advantages.0.title". */
type LeafPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every site message key (a string leaf of messages/ru.json). */
export type MessageKey = LeafPaths<SiteMessages>;

/**
 * Default messages per locale. `Record<Locale, …>` makes TypeScript require a messages file for
 * every locale in ./locales.ts, with (at least) the shape of ru.json; the key-parity test
 * (src/lib/i18n-fallback.test.ts) rejects extra keys.
 */
export const DEFAULT_MESSAGES: Readonly<Record<Locale, SiteMessages>> = { ru, en };

/** { "hero.title": "ГАДЮКА", … } — every string leaf of `tree`, in document order. */
export function flattenMessages(tree: MessageTree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flattenMessages(value, path));
  }
  return out;
}

/** Sets the leaf at a dotted path, creating branches; throws on a leaf-vs-branch conflict. */
function setLeaf(tree: MutableMessageTree, key: string, value: string): void {
  const parts = key.split('.');
  const last = parts.pop();
  if (last === undefined || last === '' || parts.some(part => part === '')) {
    throw new Error(`Invalid message key "${key}"`);
  }
  let node = tree;
  for (const part of parts) {
    const child = node[part];
    if (typeof child === 'string') throw new Error(`Message key "${key}" conflicts with the leaf at "${part}"`);
    node = child ?? (node[part] = {});
  }
  if (typeof node[last] === 'object') throw new Error(`Message key "${key}" is a branch, not a leaf`);
  node[last] = value;
}

/** Inverse of flattenMessages: { "hero.title": "…" } → { hero: { title: "…" } }. */
export function unflattenMessages(flat: Readonly<Record<string, string>>): MessageTree {
  const tree: MutableMessageTree = {};
  for (const [key, value] of Object.entries(flat)) setLeaf(tree, key, value);
  return tree;
}

const DEFAULT_FLAT: Readonly<Record<Locale, Readonly<Record<string, string>>>> = mapLocales(locale =>
  flattenMessages(DEFAULT_MESSAGES[locale]),
);

/**
 * Every message key in the order of messages/ru.json (= the display order in the admin).
 * Built at runtime from the same JSON the MessageKey type is derived from.
 */
export const MESSAGE_KEYS = Object.keys(DEFAULT_FLAT[defaultLocale]) as readonly MessageKey[];

const MESSAGE_KEY_SET: ReadonlySet<string> = new Set(MESSAGE_KEYS);

/** True for a key that exists as a string leaf in messages/ru.json (orphan DB rows are not). */
export function isMessageKey(value: string): value is MessageKey {
  return MESSAGE_KEY_SET.has(value);
}

/** "hero.title" → "hero". */
export function messageNamespace(key: MessageKey): MessageNamespace {
  // The first segment of a key derived from the ru.json tree is one of its top-level keys.
  return key.slice(0, key.indexOf('.')) as MessageNamespace;
}

/** The default (messages/<locale>.json) value of a key. */
export function defaultMessage(key: MessageKey, locale: Locale): string {
  return DEFAULT_FLAT[locale][key] ?? '';
}

/** The default value of a key in every locale: { ru: "…", en: "…" } (for the admin editor). */
export function defaultMessageTranslations(key: MessageKey): Record<Locale, string> {
  return mapLocales(locale => defaultMessage(key, locale));
}

/** One `Message` row as read from the DB. */
export type MessageRow = { readonly key: string; readonly locale: string; readonly value: string };

/** Rows of one locale, keyed by message key (blank values kept: they mean «emptied on purpose»). */
function rowsOf(rows: ReadonlyArray<MessageRow>, locale: Locale): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows) if (row.locale === locale) out.set(row.key, row.value);
  return out;
}

/**
 * The value of every message for `locale`: DB rows overlaid on the JSON defaults.
 *
 * - no row → the default of that locale (a key added by a release before `npm run db:seed`);
 * - a non-blank row → the row;
 * - a blank row in the DEFAULT locale (ru) → "" (emptied in the admin on purpose: optional
 *   parts such as «Сноска под купонами» are then hidden);
 * - a blank row in another locale → the default locale's resolved value (like LocalizedText:
 *   an empty EN shows the Russian text, empty in both = hidden);
 * - rows whose key is not a leaf of messages/ru.json (orphans of removed keys) are ignored.
 *
 * `rows` must contain the rows of `locale` and — for other locales — of the default locale.
 */
export function resolveMessageValues(locale: Locale, rows: ReadonlyArray<MessageRow>): Record<MessageKey, string> {
  const own = rowsOf(rows, locale);
  const base = locale === defaultLocale ? own : rowsOf(rows, defaultLocale);
  const out: Partial<Record<MessageKey, string>> = {};
  for (const key of MESSAGE_KEYS) {
    const value = own.get(key);
    if (value === undefined) out[key] = defaultMessage(key, locale);
    else if (value.trim() !== '') out[key] = value;
    else if (locale === defaultLocale) out[key] = '';
    else {
      const fallback = base.get(key);
      out[key] = fallback === undefined ? defaultMessage(key, defaultLocale) : fallback.trim() === '' ? '' : fallback;
    }
  }
  // Every key was assigned above.
  return out as Record<MessageKey, string>;
}

/** Same as resolveMessageValues, as the nested tree next-intl consumes (deep copy of the defaults). */
export function resolveMessages(locale: Locale, rows: ReadonlyArray<MessageRow>): SiteMessages {
  const tree: SiteMessages = structuredClone(DEFAULT_MESSAGES[locale]);
  const values = resolveMessageValues(locale, rows);
  for (const key of MESSAGE_KEYS) setLeaf(tree, key, values[key]);
  return tree;
}

/** Flat, typed view of a resolved tree: texts["hero.title"]. */
export function siteTextsFromMessages(messages: SiteMessages): Record<MessageKey, string> {
  const flat = flattenMessages(messages);
  const out: Partial<Record<MessageKey, string>> = {};
  for (const key of MESSAGE_KEYS) out[key] = flat[key] ?? '';
  // Every key was assigned above.
  return out as Record<MessageKey, string>;
}
