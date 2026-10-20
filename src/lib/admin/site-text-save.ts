import { localeNames, type Locale } from '@/i18n/locales';
import { defaultMessageTranslations, type MessageKey } from '@/i18n/messages';
import type { ImageKey } from '@/lib/content/registry';

import type { FieldErrors } from './action-result';
import type { AdminTranslator } from './i18n';

import { planSiteTextWrites, type SiteTextLabels, type SiteTextWrite, type StoredMessage } from './site-texts';

/**
 * Optimistic concurrency of the «Тексты сайта» save (saveSiteTexts) — pure, unit-tested.
 *
 * The editor sends only what the owner changed (plus the languages that have no row yet),
 * each with `base`: the stored text the edit started from. The action reads the rows inside
 * its transaction, under a lock that serializes every «Тексты сайта» write, and plans:
 * - an edit (value ≠ base) whose row now holds a third text — changed in another tab or
 *   session since the editor loaded it — is a conflict: the whole save is refused, so a stale
 *   tab can never put an older text back over a newer one;
 * - an edit whose row still holds `base` (or already holds the value) is written as usual
 *   (planSiteTextWrites: only what changes, editedAt by the default);
 * - an unchanged text (value = base, whitespace aside) is never written over a row: a missing
 *   row gets the default the site shows, an existing one is left as it is.
 * Landing images likewise: a picked image (mediaId ≠ base) conflicts with a third media.
 */

/** One language of a text in the save: the trimmed value and the stored text it started from. */
export type SiteTextChange = { key: MessageKey; locale: Locale; value: string; base: string };

/** A landing image in the save: the picked media and the stored one it replaced (null = none). */
export type SiteImageChange = { key: ImageKey; mediaId: string | null; base: string | null };

/** A text changed elsewhere since the editor loaded it: what the row holds now. */
export type SiteTextConflict = { key: MessageKey; locale: Locale; current: string };

export type SiteTextSavePlan = {
  conflicts: SiteTextConflict[];
  writes: SiteTextWrite[];
  /** What every submitted text holds after the save (the editor shows it). */
  stored: Partial<Record<MessageKey, Partial<Record<Locale, string>>>>;
};

/** An edit, not a resend of the stored text (the value is trimmed by the schema, the base is not). */
export function isSiteTextEdit(change: Pick<SiteTextChange, 'value' | 'base'>): boolean {
  return change.value !== change.base.trim();
}

/** The Message writes of `changes` against the rows read inside the save's transaction. */
export function planSiteTextSave(
  changes: readonly SiteTextChange[],
  rows: readonly StoredMessage[],
  now: Date,
): SiteTextSavePlan {
  const byId = new Map(rows.map(row => [`${row.locale}\u0000${row.key}`, row]));
  const conflicts: SiteTextConflict[] = [];
  const accepted: Array<{ key: MessageKey; values: Partial<Record<Locale, string>> }> = [];
  const stored: SiteTextSavePlan['stored'] = {};
  for (const change of changes) {
    const { key, locale } = change;
    const row = byId.get(`${locale}\u0000${key}`);
    // What the site shows now: the row, or the default while the row is missing.
    const current = row ? row.value : defaultMessageTranslations(key)[locale];
    if (!isSiteTextEdit(change)) {
      if (!row) accepted.push({ key, values: { [locale]: current } });
      stored[key] = { ...stored[key], [locale]: current };
      continue;
    }
    if (current !== change.base && current !== change.value) {
      conflicts.push({ key, locale, current });
      continue;
    }
    accepted.push({ key, values: { [locale]: change.value } });
    stored[key] = { ...stored[key], [locale]: change.value };
  }
  return { conflicts, writes: conflicts.length > 0 ? [] : planSiteTextWrites(accepted, rows, now), stored };
}

export type SiteImageSavePlan = {
  conflicts: ImageKey[];
  writes: Array<{ key: ImageKey; mediaId: string | null }>;
};

/** The ContentImage writes of `changes` against the rows read inside the save's transaction. */
export function planSiteImageSave(
  changes: readonly SiteImageChange[],
  rows: ReadonlyArray<{ key: string; mediaId: string | null }>,
): SiteImageSavePlan {
  const byKey = new Map(rows.map(row => [row.key, row]));
  const conflicts: ImageKey[] = [];
  const writes: SiteImageSavePlan['writes'] = [];
  for (const change of changes) {
    if (change.mediaId === change.base) continue;
    const row = byKey.get(change.key);
    const current = row ? row.mediaId : null;
    if (current !== change.base && current !== change.mediaId) conflicts.push(change.key);
    else if (!row || current !== change.mediaId) writes.push({ key: change.key, mediaId: change.mediaId });
  }
  return { conflicts, writes: conflicts.length > 0 ? [] : writes };
}

/** How many conflicting texts the message names (the rest are counted). */
const CONFLICTS_LISTED = 5;
/** Length of the stored text quoted in a conflict's field error. */
const CONFLICT_PREVIEW_LENGTH = 140;

function preview(text: string): string {
  return text.length > CONFLICT_PREVIEW_LENGTH ? `${text.slice(0, CONFLICT_PREVIEW_LENGTH)}…` : text;
}

/**
 * The refusal of a save with conflicts: the message names the texts and images changed
 * elsewhere and asks to reload; each of them gets a field error (a text quotes what is
 * stored now, so the owner can compare it with the edit before reloading).
 */
export function siteTextConflictFailure(
  texts: readonly SiteTextConflict[],
  images: readonly ImageKey[],
  labels: SiteTextLabels,
  t: AdminTranslator<'admin.siteTexts.errors'>,
): { message: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const names: string[] = [];
  for (const conflict of texts) {
    names.push(t('conflictText', { label: labels.text(conflict.key), language: localeNames[conflict.locale].short }));
    fieldErrors[`${conflict.key}.${conflict.locale}`] =
      conflict.current.trim() === ''
        ? t('conflictFieldEmpty')
        : t('conflictField', { current: preview(conflict.current) });
  }
  for (const key of images) {
    names.push(t('conflictImage', { label: labels.image(key) }));
    fieldErrors[key] = t('conflictImageField');
  }
  const listed = names.slice(0, CONFLICTS_LISTED).join(', ');
  const rest = names.length - CONFLICTS_LISTED;
  const list = rest > 0 ? t('conflictMore', { texts: listed, count: rest }) : listed;
  return { message: t('conflict', { texts: list }), fieldErrors };
}
