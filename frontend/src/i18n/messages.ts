import en from '@shared/messages/en.json';
import ru from '@shared/messages/ru.json';

import { defaultLocale, mapLocales, type Locale } from './locales';

/**
 * Site UI messages — the static side (ISOMORPHIC and pure: no DB, no server-only imports).
 *
 * shared/messages/<locale>.json holds the DEFAULT value of every site UI string and is the single
 * source of the key set: the seed writes every leaf into the `Message` table (key = dotted
 * path, e.g. "hero.title", "about.advantages.0.title"), the admin edits those rows, and the
 * site renders the DB value overlaid on these defaults (./site-messages.ts, server-only), so
 * a missing row never breaks a page.
 *
 * Not in here: the admin UI strings (shared/messages/admin/*.json — the "admin" namespace, loaded by
 * ./request.ts, never seeded or editable) and the demo entity copy used by the seed only
 * (shared/messages/content/*.json).
 */

/** The site message tree: the shape of shared/messages/ru.json (every locale file has the same shape). */
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

/** Every site message key (a string leaf of shared/messages/ru.json). */
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
 * Every message key in the order of shared/messages/ru.json (= the display order in the admin).
 * Built at runtime from the same JSON the MessageKey type is derived from.
 */
export const MESSAGE_KEYS = Object.keys(DEFAULT_FLAT[defaultLocale]) as readonly MessageKey[];

const MESSAGE_KEY_SET: ReadonlySet<string> = new Set(MESSAGE_KEYS);

/** True for a key that exists as a string leaf in shared/messages/ru.json (orphan DB rows are not). */
export function isMessageKey(value: string): value is MessageKey {
  return MESSAGE_KEY_SET.has(value);
}

/** "hero.title" → "hero". */
export function messageNamespace(key: MessageKey): MessageNamespace {
  // The first segment of a key derived from the ru.json tree is one of its top-level keys.
  return key.slice(0, key.indexOf('.')) as MessageNamespace;
}

/** The default (shared/messages/<locale>.json) value of a key. */
export function defaultMessage(key: MessageKey, locale: Locale): string {
  return DEFAULT_FLAT[locale][key] ?? '';
}

/** The bundled defaults of a locale as a fresh tree (the stand-in while the backend is unreachable). */
export function defaultSiteMessages(locale: Locale): SiteMessages {
  return structuredClone(DEFAULT_MESSAGES[locale]);
}

/**
 * The site messages as the backend resolved them (GET /api/v1/public/messages/:locale — the admin's
 * edits over the shared defaults, backend/src/module/site-messages) as the typed tree next-intl consumes:
 * every key of shared/messages/ru.json, its backend value when that is a string, else the bundled
 * default (a key the backend does not know yet). Keys the frontend does not know are dropped.
 */
export function siteMessagesFromTree(locale: Locale, tree: MessageTree): SiteMessages {
  const resolved = flattenMessages(tree);
  const messages = defaultSiteMessages(locale);
  for (const key of MESSAGE_KEYS) setLeaf(messages, key, resolved[key] ?? defaultMessage(key, locale));
  return messages;
}

/** Flat, typed view of a resolved tree: texts["hero.title"]. */
export function siteTextsFromMessages(messages: SiteMessages): Record<MessageKey, string> {
  const flat = flattenMessages(messages);
  const out: Partial<Record<MessageKey, string>> = {};
  for (const key of MESSAGE_KEYS) out[key] = flat[key] ?? '';
  // Every key was assigned above.
  return out as Record<MessageKey, string>;
}
