/**
 * Accepted upload formats, detected by magic bytes (never by extension / client MIME). SVG is
 * deliberately NOT accepted: it can carry scripts (stored XSS).
 */
export enum AcceptedImageMime {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
  AVIF = 'image/avif',
  GIF = 'image/gif',
}

/** The accepted formats as shown to the admin (language-neutral names). */
export const ACCEPTED_FORMATS_LABEL = 'JPEG, PNG, WebP, AVIF, GIF';
