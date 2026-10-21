import { locales, mapLocales, type Locale } from '@/i18n/locales';
import type { LocalizedText } from '@/lib/localized-text';
import type { MediaRef } from '@shared/contracts/common';

/**
 * Local state of the «Тексты сайта» editor (SiteTextsForm) — pure, unit-tested.
 *
 * The page passes the stored texts and images (it re-renders with fresh ones after every save
 * or reset). The editor keeps a Draft only for a field the owner touched or saved:
 * - value — what the field shows;
 * - base  — the stored text the value started from: sent with an edit, so the server can
 *           refuse it when the text was changed in another tab or session meanwhile;
 * - seen  — the stored text the page passed when the draft was set.
 * A draft whose value equals its base holds no edit: it keeps showing a value just saved until
 * the page re-renders with it (the action answers before the page does), then the field follows
 * the page again — a newer text from another tab included. A field without a draft (also a text
 * that starts matching a search after a refresh) shows the page's text.
 * Only edits — and languages without a row, which a save creates — are sent: an untouched text
 * of a stale tab can never be written back.
 */
export type Draft<T> = { value: T; base: T; seen: T };

type Same<T> = (a: T, b: T) => boolean;

const sameText: Same<string> = (a, b) => a === b;
const sameMedia: Same<MediaRef | null> = (a, b) => (a?.id ?? null) === (b?.id ?? null);

/** A draft without an edit, outdated by a newer page: the field follows the page. */
function follows<T>(draft: Draft<T>, stored: T, same: Same<T>): boolean {
  return same(draft.value, draft.base) && !same(draft.seen, stored);
}

function shown<T>(draft: Draft<T> | undefined, stored: T, same: Same<T>): T {
  return !draft || follows(draft, stored, same) ? stored : draft.value;
}

function baseOf<T>(draft: Draft<T> | undefined, stored: T, same: Same<T>): T {
  return !draft || follows(draft, stored, same) ? stored : draft.base;
}

function edit<T>(draft: Draft<T> | undefined, stored: T, next: T, same: Same<T>): Draft<T> {
  return { value: next, base: baseOf(draft, stored, same), seen: stored };
}

/**
 * After a successful save: what was sent is `saved` now (trimmed by the server) — unless the
 * owner kept typing while the save ran: that newer value stays, as an edit of `saved`.
 * `seen` = the page's value when the save was sent.
 */
function settle<T>(draft: Draft<T> | undefined, sent: T, saved: T, seen: T, same: Same<T>): Draft<T> {
  if (draft && !same(shown(draft, seen, same), sent)) return { value: draft.value, base: saved, seen: draft.seen };
  return { value: saved, base: saved, seen };
}

// ── texts ─────────────────────────────────────────────────────────────────────

export type TextDrafts = Readonly<Record<string, Partial<Record<Locale, Draft<string>>>>>;

/** A text as the page passes it (SiteTextEntry): its stored value in every language. */
type StoredText = { key: string; values: Record<Locale, string> };

/** What the field of a text shows, in every language. */
export function shownText(drafts: TextDrafts, entry: StoredText): Record<Locale, string> {
  return mapLocales(locale => shown(drafts[entry.key]?.[locale], entry.values[locale], sameText));
}

/** «не сохранено»: some language holds an edit that differs from what the page shows as stored. */
export function hasUnsavedText(drafts: TextDrafts, entry: StoredText): boolean {
  return locales.some(locale => {
    const draft = drafts[entry.key]?.[locale];
    const stored = entry.values[locale];
    const value = shown(draft, stored, sameText);
    return value !== baseOf(draft, stored, sameText) && value !== stored;
  });
}

/** The owner typed: `next` holds every language of the field (LocalizedField). */
export function editText(drafts: TextDrafts, entry: StoredText, next: LocalizedText): TextDrafts {
  const own = { ...drafts[entry.key] };
  let changed = false;
  for (const locale of locales) {
    const stored = entry.values[locale];
    const value = next[locale] ?? '';
    if (value === shown(own[locale], stored, sameText)) continue;
    own[locale] = edit(own[locale], stored, value, sameText);
    changed = true;
  }
  return changed ? { ...drafts, [entry.key]: own } : drafts;
}

/** One text of the save payload (SiteTextChangeRequest, PUT /api/v1/admin/site-texts). */
export type TextChange = { key: string; values: Partial<Record<Locale, { value: string; base: string }>> };

/**
 * The texts to send: every edited language with its base, and every language without a row
 * (the save creates it with the default). Untouched stored texts are not sent.
 */
export function textChanges(
  drafts: TextDrafts,
  entries: ReadonlyArray<StoredText & { missing: readonly Locale[] }>,
): TextChange[] {
  return entries.flatMap(entry => {
    const values: TextChange['values'] = {};
    for (const locale of locales) {
      const draft = drafts[entry.key]?.[locale];
      const stored = entry.values[locale];
      const value = shown(draft, stored, sameText);
      const base = baseOf(draft, stored, sameText);
      if (value !== base || entry.missing.includes(locale)) values[locale] = { value, base };
    }
    return Object.keys(values).length > 0 ? [{ key: entry.key, values }] : [];
  });
}

/**
 * After a successful save (or reset) of `sent`: `saved` holds what the server stored per key and
 * language, `seen` the page's texts when the save was sent.
 */
export function settleTexts(
  drafts: TextDrafts,
  sent: readonly TextChange[],
  saved: Readonly<Partial<Record<string, Partial<Record<Locale, string>>>>>,
  seen: Readonly<Record<string, Record<Locale, string>>>,
): TextDrafts {
  const next = { ...drafts };
  for (const change of sent) {
    const own = { ...next[change.key] };
    for (const locale of locales) {
      const value = change.values[locale]?.value;
      const stored = saved[change.key]?.[locale];
      const page = seen[change.key]?.[locale];
      if (value === undefined || stored === undefined || page === undefined) continue;
      own[locale] = settle(own[locale], value, stored, page, sameText);
    }
    next[change.key] = own;
  }
  return next;
}

// ── landing images ────────────────────────────────────────────────────────────

export type ImageDrafts = Readonly<Record<string, Draft<MediaRef | null>>>;

/** A landing image as the page passes it (SiteImageEntry). */
type StoredImage = { key: string; media: MediaRef | null };

export function shownImage(drafts: ImageDrafts, image: StoredImage): MediaRef | null {
  return shown(drafts[image.key], image.media, sameMedia);
}

export function editImage(drafts: ImageDrafts, image: StoredImage, media: MediaRef | null): ImageDrafts {
  return { ...drafts, [image.key]: edit(drafts[image.key], image.media, media, sameMedia) };
}

/** One landing image of the save: the picked media and the stored one it replaces. */
export type ImageChange = { key: string; media: MediaRef | null; base: MediaRef | null };

/** The images to send: only the ones the owner changed. */
export function imageChanges(drafts: ImageDrafts, images: readonly StoredImage[]): ImageChange[] {
  return images.flatMap(image => {
    const media = shownImage(drafts, image);
    const base = baseOf(drafts[image.key], image.media, sameMedia);
    return sameMedia(media, base) ? [] : [{ key: image.key, media, base }];
  });
}

/** After a successful save of `sent` (stored as sent); `seen` = the page's images when it was sent. */
export function settleImages(
  drafts: ImageDrafts,
  sent: readonly ImageChange[],
  seen: Readonly<Record<string, MediaRef | null>>,
): ImageDrafts {
  const next = { ...drafts };
  for (const change of sent) {
    next[change.key] = settle(next[change.key], change.media, change.media, seen[change.key] ?? null, sameMedia);
  }
  return next;
}
