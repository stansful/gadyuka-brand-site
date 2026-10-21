/**
 * Site texts and landing images of the admin «Тексты сайта» (owner: slice S3).
 *
 * The key set is shared/messages/ru.json: every string leaf is one site text (key = dotted path,
 * "hero.title"), with one Message row per locale; its top-level namespace is the admin section it is
 * listed in. The site shows the row, or the shared/messages default while the row is missing.
 * `edited` = Message.editedAt: set = edited in the admin, absent = the default.
 *
 * - GET  /admin/site-texts?section=&q=  SiteTextsPageQuery → 200 SiteTextsPageResponse
 * - PUT  /admin/site-texts              SiteTextsSaveRequest → 200 SiteTextsSaveResponse
 * - POST /admin/site-texts/reset        SiteTextResetRequest → 200 SiteTextResetResponse
 *
 * Errors of the save (the frontend action renders them as today's form errors):
 * - 400 validation, shape of the request: fields "entries.<i>.key", "entries.<i>.values.<locale>.value",
 *   "images.<i>.mediaId", "entries", "images" … (admin.validation.* keys);
 * - 400 validation, the texts themselves: fields "" = admin.siteTexts.errors.fixErrors (the form
 *   message) plus "<message key>.<locale>" (admin.siteTexts.errors.* with {token, allowed}),
 *   "<message key>" (unknownKey), "<image key>" (unknownImage);
 * - 400 validation, a picked image no longer exists: fields "" and "<image key>" = admin.errors.missingMedia;
 * - 409 conflict (admin.siteTexts.errors.conflict): nothing was saved, `details` = SiteTextsConflictDetails.
 * Reset: 404 notFound (admin.siteTexts.errors.unknownKey) for a key that is no site text.
 * Save and reset answer within SiteTextsWriteTimeoutMs (not the default ApiRequestTimeoutMs).
 * Every write drops the backend's message cache; the frontend then calls updateTag('content').
 */

import type { IsoDateTime, Locale, MediaRef, Uuid } from './common';

/**
 * How the admin edits a text and how the site fills it in:
 * - text: one line of plain text; richtext: paragraphs separated by an empty line (no HTML);
 * - icu: an ICU template the server fills in ({arguments}, plural forms, <tags>);
 * - template: a simple template the public client components fill in (bare {arguments} and the
 *   default's <tags>, each once — no plural forms or formats);
 * - link: a URL or an in-page anchor.
 */
export type SiteTextKind = 'text' | 'richtext' | 'icu' | 'template' | 'link';

/** One site text in the editor (labels are admin copy: admin.siteTexts.labels.<key>). */
export interface SiteTextEntry {
  readonly key: string;
  readonly kind: SiteTextKind;
  /** The Russian text must not be empty (headings, buttons, links, accessible names) */
  readonly required: boolean;
  /** What the site shows: the row value, or the default while the row is missing */
  readonly values: Readonly<Record<Locale, string>>;
  /** shared/messages/<locale>.json — what «Вернуть по умолчанию» restores */
  readonly defaults: Readonly<Record<Locale, string>>;
  /** Message.editedAt of the locales edited in the admin (no entry = the default text) */
  readonly edited: Readonly<Partial<Record<Locale, IsoDateTime>>>;
  /** Locales without a row yet (the site shows the default; a save creates it) */
  readonly missing: readonly Locale[];
  /** {arguments} and <tags> of the default (the code fills them in — they must stay) */
  readonly placeholders: readonly string[];
  readonly tags: readonly string[];
}

/** A landing image (ContentImage row) edited next to the texts of its section. */
export interface SiteImageEntry {
  /** "about.image" (names: admin.siteTexts.images.<key>) */
  readonly key: string;
  readonly media: MediaRef | null;
}

/** One section of the editor, or the search matches of one section (images only in section mode). */
export interface SiteTextGroup {
  /** Section id = top-level namespace of the messages ("hero"; names: admin.siteTexts.sections.<id>) */
  readonly section: string;
  readonly entries: readonly SiteTextEntry[];
  readonly images: readonly SiteImageEntry[];
}

/** A tab of the section bar with its counters. */
export interface SiteTextSectionSummary {
  readonly id: string;
  readonly total: number;
  /** Texts edited in the admin (any locale) */
  readonly edited: number;
  /** Texts with a Russian text and an empty translation (the site shows Russian there) */
  readonly gaps: number;
  /** Texts without a row in some locale (the default is shown) */
  readonly unsaved: number;
}

/** GET /admin/site-texts query. Without `q` (or a blank one): one section — an unknown one falls back to «hero». */
export interface SiteTextsPageQuery {
  readonly section?: string;
  /** Search across every section: key, admin label, current or default value; case- and «ё»-insensitive */
  readonly q?: string;
}

export interface SiteTextsPageResponse {
  readonly sections: readonly SiteTextSectionSummary[];
  /** "section" = one section with its images; "search" = the matches of `query` across sections */
  readonly mode: 'section' | 'search';
  /** The active section in "section" mode (null when there are no texts at all, and in search mode) */
  readonly section: string | null;
  /** The normalized query in "search" mode (trimmed, spaces collapsed, ≤ 100 characters), else "" */
  readonly query: string;
  readonly groups: readonly SiteTextGroup[];
}

/** One language of a text in the save: the value (trimmed by the backend) and the stored text it started from. */
export interface SiteTextValueChange {
  readonly value: string;
  readonly base: string;
}

/** A text of the save: only the edited languages, plus the languages without a row (sent as stored). */
export interface SiteTextChangeRequest {
  readonly key: string;
  readonly values: Readonly<Partial<Record<Locale, SiteTextValueChange>>>;
}

/** A landing image of the save: the picked media and the stored one it replaced (null = none). */
export interface SiteImageChangeRequest {
  readonly key: string;
  readonly mediaId: Uuid | null;
  readonly base: Uuid | null;
}

/** PUT /admin/site-texts — ≤ 500 texts (unique keys), ≤ 20 images (unique keys), texts ≤ 10 000 characters. */
export interface SiteTextsSaveRequest {
  readonly entries: readonly SiteTextChangeRequest[];
  readonly images: readonly SiteImageChangeRequest[];
}

export interface SiteTextsSaveResponse {
  /** Rows written (texts + images); 0 = nothing changed («Изменений нет») */
  readonly saved: number;
  /** What every submitted text holds after the save, per key and language (the editor shows it) */
  readonly values: Readonly<Record<string, Readonly<Partial<Record<Locale, string>>>>>;
}

/**
 * `details` of the 409 conflict of a save, in the order of the request: "<message key>.<locale>" → the
 * text stored now (changed in another tab or session since the editor loaded it), "<image key>" → true
 * (the image was replaced meanwhile).
 */
export type SiteTextsConflictDetails = Readonly<Record<string, string | boolean>>;

/** POST /admin/site-texts/reset — every locale of the text gets its default back (editedAt = null). */
export interface SiteTextResetRequest {
  readonly key: string;
}

export interface SiteTextResetResponse {
  readonly key: string;
  /** The defaults now stored */
  readonly values: Readonly<Record<Locale, string>>;
}

/**
 * How long the frontend waits for the answer of a save or reset, in milliseconds, instead of
 * http.ts ApiRequestTimeoutMs: both run in one transaction under the «Тексты сайта» lock (waiting
 * for a connection and the lock, then a large save), and the backend keeps that budget plus the
 * checks around it below this value.
 */
export type SiteTextsWriteTimeoutMs = 45_000;
