/**
 * The admin media library (slice S5; port of the frontend's src/lib/admin/media-service.ts and
 * src/app/admin/api/media). Upload limits and image processing: ./media.constants.ts.
 */

/** Files per page of GET /admin/media (newest first). */
export const MEDIA_PAGE_SIZE = 60;
/** The search text is trimmed and cut to this many characters. */
export const MAX_MEDIA_SEARCH_LENGTH = 100;
/** Longest alt text per language. */
export const MAX_MEDIA_ALT_LENGTH = 300;
/** Places listed per kind of reference in the details (a file is used in a handful of places). */
export const MAX_USAGES_PER_KIND = 100;

/** Multipart field with the uploaded image (shared/contracts/media.ts `MediaUploadField`). */
export const MEDIA_UPLOAD_FIELD = 'file';
/** Text fields an upload may carry besides the file (the admin sends none). */
export const MAX_MEDIA_UPLOAD_FIELDS = 8;
/** Longest text field of an upload (bytes). */
export const MAX_MEDIA_UPLOAD_FIELD_BYTES = 16 * 1024;
