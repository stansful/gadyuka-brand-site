import { MESSAGE_KEYS, messageNamespace, type MessageKey } from '@/i18n/messages';
import siteTextMetadata from '@shared/messages/meta/site-texts.json';

/**
 * Test helpers over shared/messages/meta/site-texts.json — the metadata the backend validates admin
 * edits with (kinds, required texts, section order). The frontend's tests check it against what the
 * site renders: the texts its client components fill in, the labels that must never be empty.
 */

type TextMetadata = { readonly kind?: string; readonly required?: boolean };

const TEXTS: Readonly<Record<string, TextMetadata>> = siteTextMetadata.texts;

/** The admin's section order (= every top-level namespace of shared/messages/ru.json). */
export const SITE_TEXT_SECTIONS: readonly string[] = siteTextMetadata.sections;

/** Keys with metadata (each must be a message key). */
export const METADATA_KEYS: readonly string[] = Object.keys(TEXTS);

function metadataOf(key: string): TextMetadata {
  return Object.prototype.hasOwnProperty.call(TEXTS, key) ? (TEXTS[key] ?? {}) : {};
}

/** The kind the metadata sets for a key (undefined: the backend detects it from the defaults). */
export function kindOverride(key: MessageKey): string | undefined {
  return metadataOf(key).kind;
}

/** True for keys that must have text in the default locale. */
export function isRequiredKey(key: MessageKey): boolean {
  return metadataOf(key).required === true;
}

/** Keys of a section in shared/messages/ru.json order. */
export function sectionMessageKeys(section: string): MessageKey[] {
  return MESSAGE_KEYS.filter(key => messageNamespace(key) === section);
}
