/**
 * Admin media library (owner: slice S5): /api/v1/admin/media — upload (multipart), list (cursor
 * pages + search), details + usages, alt text, delete (refused while used). Every route needs a
 * signed-in ADMIN. Files themselves are served by GET|HEAD /media/<key> (public, no internal key).
 */
import type { CursorPage, IsoDateTime, LocalizedText, MediaRef, Uuid } from './common';

/** A file of the media library (list item, details, upload answer). */
export interface MediaItem extends MediaRef {
  /** Stored format: always "image/webp" for uploads */
  readonly mime: string;
  /** Bytes of the stored file */
  readonly size: number;
  /** Name of the uploaded file (display only), null when unknown */
  readonly originalName: string | null;
  readonly createdAt: IsoDateTime;
  /** Number of places that reference the file (0 = it can be deleted) */
  readonly usageCount: number;
}

/**
 * POST /api/v1/admin/media — multipart/form-data with ONE image in the field `file` (JPEG, PNG,
 * WebP, AVIF or GIF by its bytes, at most 50 MB). Stored as WebP fitted inside 2400×2400 at
 * "admin/<admin id>/<uuid>/image.webp" → 201 MediaItem.
 * Errors (`key` of shared/messages/admin): 400 admin.media.errors.noFile / unreadable / empty /
 * processingFailed, 413 admin.media.errors.tooLarge { size }, 415 admin.media.errors.unsupported
 * { formats }.
 */
export type MediaUploadField = 'file';
export type MediaUploadResponse = MediaItem;

/**
 * GET /api/v1/admin/media?cursor=&q= — newest first, 60 per page. 400 validation
 * `cursor: admin.media.errors.badCursor` for a malformed cursor.
 */
export interface MediaListRequest {
  /** `nextCursor` of the previous page (a media id) */
  readonly cursor?: Uuid;
  /** Search in the original file name: case-insensitive, trimmed, the first 100 characters */
  readonly q?: string;
}

export interface MediaListResponse extends CursorPage<MediaItem> {
  /** Number of all files of the library (not only the matching ones) */
  readonly total: number;
}

/** What references a file — also the key of its name in admin.media.usages. */
export type MediaUsageKind =
  | 'landingImage'
  | 'collectionCover'
  | 'productPhoto'
  | 'reviewAvatar'
  | 'news'
  | 'gallery'
  | 'offer'
  | 'partnerLogo'
  | 'settings';

/** One place that uses a file, with the admin page to change it there. */
export interface MediaUsage {
  readonly kind: MediaUsageKind;
  /** Admin page of the place ("/admin/products/<id>", "/admin/content?section=about", "/admin/settings") */
  readonly href: string;
  /**
   * Name of the place as stored, in the default locale (ru): the title / author / name of the row;
   * "" when it has none (an untitled gallery photo, the settings, a landing image)
   */
  readonly title: string;
  /** Landing image key ("about.image") for `landingImage`, null for the other kinds */
  readonly contentKey: string | null;
}

/** GET /api/v1/admin/media/:id → 200; 404 admin.media.errors.notFound. */
export interface MediaDetailsResponse {
  readonly media: MediaItem;
  /** Every place that uses the file, grouped by kind (landing images first, the settings last) */
  readonly usages: readonly MediaUsage[];
}

/**
 * PATCH /api/v1/admin/media/:id/alt — the alt text in every language (empty translations are
 * dropped). 400 validation `alt.<locale>: admin.validation.tooLong { max: 300 }`; 404
 * admin.errors.notFound.
 */
export interface MediaAltRequest {
  readonly alt: LocalizedText;
}

export interface MediaAltResponse {
  readonly id: Uuid;
  /** The stored alt text */
  readonly alt: LocalizedText;
}

/**
 * DELETE /api/v1/admin/media/:id → 204 (the row, then the stored file). 404
 * admin.media.errors.notFoundDeleted; 409 admin.media.errors.inUse with `details` below (GET
 * /admin/media/:id lists the places); 409 admin.errors.related when a reference appeared meanwhile.
 */
export interface MediaInUseDetails {
  readonly usageCount: number;
}
