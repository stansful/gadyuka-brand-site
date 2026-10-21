import { MESSAGE_KEYS, DEFAULT_MESSAGES, isMessageKey, type MessageKey, type MessageNamespace } from '@/i18n/messages';
import siteTextMetadata from '@shared/messages/meta/site-texts.json';

/**
 * The site copy's structure as the site renders it (server-side; isomorphic, no runtime deps).
 *
 * THE KEY SET IS shared/messages/ru.json: every string leaf is one site text (key = dotted path, e.g.
 * "hero.title"), its top-level namespace is the section it belongs to. What the JSON cannot say —
 * the admin's section order, the kinds and required flags of texts, the landing images — is
 * shared/messages/meta/site-texts.json, owned by the backend (admin validation, the seed); the site
 * reads the landing image keys from it, its tests read the rest (src/lib/content/registry.test.ts).
 * The Russian admin names of sections, texts and images are admin copy (admin.siteTexts.* in
 * shared/messages/admin/ru.json).
 *
 * To add copy: add the key to shared/messages/<locale>.json (every locale; key-parity test), give it
 * an admin label in shared/messages/admin/ru.json (admin.siteTexts.labels.<key>) if the key alone is
 * not clear, add its kind / required flag to the metadata when it needs one, render it on the site,
 * run `npm run db:seed` in backend/.
 */

/** A section of the site copy = a top-level namespace of shared/messages/ru.json ("hero", "forms" …). */
export type SectionId = MessageNamespace;

const SECTION_IDS: ReadonlySet<string> = new Set(Object.keys(DEFAULT_MESSAGES.ru));

export function isSectionId(value: unknown): value is SectionId {
  return typeof value === 'string' && SECTION_IDS.has(value);
}

/** Section anchors live in ./anchors (tiny, imported by client components); re-exported here. */
export { LEAD_FORM_ANCHOR, SECTION_ANCHORS } from './anchors';

/**
 * Landing chapters in page order (the owner's): «Глава 01» = catalog, 02 about, [the red band],
 * 03 tailoring, 04 offers, 05 news, 06 gallery, 07 reviews, 08 partners, «Глава 09» = contacts.
 * Chapter numbers, folios («— 02 —») and the red band position are derived from this list,
 * so they always follow the actual order of the sections.
 */
export const CHAPTER_ORDER = [
  'catalog',
  'about',
  'tailoring',
  'offers',
  'news',
  'gallery',
  'reviews',
  'partners',
  'contacts',
] as const satisfies ReadonlyArray<SectionId>;

export type ChapterId = (typeof CHAPTER_ORDER)[number];

/** "02" for about. */
export function chapterNumber(id: ChapterId): string {
  return String(CHAPTER_ORDER.indexOf(id) + 1).padStart(2, '0');
}

// ── messages ────────────────────────────────────────────────────────────────

/** Re-exported for the content layer: a site message key ("hero.title"). */
export type { MessageKey, MessageNamespace };
export { MESSAGE_KEYS, isMessageKey };

/**
 * Key of a landing text: texts["hero.title"]. Same as MessageKey (the landing reads every
 * site message); the name is kept for the site sections.
 */
export type TextKey = MessageKey;
/** All site message keys (= MESSAGE_KEYS), the keys of LandingContent.texts. */
export const TEXT_KEYS: readonly TextKey[] = MESSAGE_KEYS;

// ── images ──────────────────────────────────────────────────────────────────

/**
 * A landing image addressed by key — a `ContentImage` row (key → Media), listed in
 * shared/messages/meta/site-texts.json `images` with the section it is edited with. Not messages:
 * the keys never appear in shared/messages/*.json.
 */
export type ImageKey = keyof typeof siteTextMetadata.images;

/** Landing image key → its section (the admin edits it with that section's texts). */
export const CONTENT_IMAGES: Readonly<Record<ImageKey, string>> = siteTextMetadata.images;

function isOwnKey<T extends object>(record: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function isImageKey(value: string): value is ImageKey {
  return isOwnKey(CONTENT_IMAGES, value);
}

export const IMAGE_KEYS: readonly ImageKey[] = Object.keys(CONTENT_IMAGES).filter(isImageKey);
