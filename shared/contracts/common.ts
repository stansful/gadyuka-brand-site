/**
 * Shapes shared by several API areas. Type-only (see README.md): ids are UUID strings, dates ISO 8601
 * strings, translatable fields LocalizedText.
 */

/** Site languages (backend: Locale enum, frontend: src/i18n/locales.ts). */
export type Locale = 'ru' | 'en';

/** A translatable field as stored ({ ru: "…", en: "…" }); a missing / empty locale falls back to ru. */
export type LocalizedText = Readonly<Partial<Record<Locale, string>>>;

/** ISO 8601 date-time ("2026-10-21T12:00:00.000Z"). */
export type IsoDateTime = string;

/** A row id (UUID v7). */
export type Uuid = string;

/** A picture as the public site renders it (already localized for the requested locale). */
export interface ImageRef {
  /** Media.id */
  readonly id: Uuid;
  /** Public URL (Media.url): "/media/admin/<ownerId>/<uuid>/image.webp" */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly mime: string;
  /** Alt text in the requested locale ("" when not filled in for it — no fallback) */
  readonly alt: string;
  /** Alt text in the default locale (use after any own fallback: `alt || fallbackAlt || altDefault`) */
  readonly altDefault: string;
}

/** A picture as the admin edits it (thumbnails, pickers): every translation of the alt text. */
export interface MediaRef {
  readonly id: Uuid;
  /** Public URL (Media.url) */
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly alt: LocalizedText;
}

/** Query of a cursor-paginated list: `cursor` = `nextCursor` of the previous page. */
export interface CursorPageRequest {
  readonly cursor?: string;
  /** Page size (each endpoint documents its default and maximum) */
  readonly limit?: number;
}

/** A page of a cursor-paginated list; `nextCursor` null = the last page. */
export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/** Query of a numbered list (1-based `page`). */
export interface OffsetPageRequest {
  readonly page?: number;
  readonly pageSize?: number;
}

/** A page of a numbered list with the total count of matching rows. */
export interface OffsetPage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}
