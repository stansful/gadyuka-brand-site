/**
 * Upload limits as the admin upload UI shows and pre-checks them (isomorphic, no Node imports).
 * The backend enforces the same limits (backend/src/core/media/media.constants.ts); keep both in step.
 */

/** 15 MB per file. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** The same limit in whole megabytes, for messages («Файл больше 15 МБ»). */
export const MAX_UPLOAD_MEGABYTES = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);

/** Longest side after processing (px). Smaller images are never upscaled. */
export const MAX_IMAGE_DIMENSION = 2400;

/**
 * Accepted input formats, detected by magic bytes (never by extension / client MIME).
 * SVG is deliberately NOT accepted: it can carry scripts (stored XSS).
 */
export const ACCEPTED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'] as const;
export type AcceptedImageMime = (typeof ACCEPTED_IMAGE_MIME)[number];

/** For <input type="file" accept>. */
export const IMAGE_ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_MIME.join(',');

/** The accepted formats as shown to the admin (language-neutral names). */
export const ACCEPTED_FORMATS_LABEL = 'JPEG, PNG, WebP, AVIF, GIF';

export function isAcceptedImageMime(value: string): value is AcceptedImageMime {
  return (ACCEPTED_IMAGE_MIME as readonly string[]).includes(value);
}
