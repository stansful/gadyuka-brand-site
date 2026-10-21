/**
 * Media files (port of the frontend's src/lib/storage/keys.ts and src/lib/admin/media-constants.ts).
 *
 * - Every upload gets its own folder in the bucket: key = "<admin|user>/<ownerId>/<uuid>/image.webp"
 *   (also a CHECK constraint on media.key). The uuid is new for every upload, so an object is never
 *   rewritten in place and responses are cached for a year.
 * - Public URL = MEDIA_URL_PREFIX + "/" + key: GET /media/<key> of this backend (the Next.js site
 *   rewrites /media/* here). Stored as media.url and used as-is by the site and the admin.
 */
export const MEDIA_URL_PREFIX = '/media';

/** File name of the single optimized WebP stored per upload. */
export const MEDIA_FILE_NAME = 'image.webp';
export const MEDIA_MIME = 'image/webp';

/** Cache-Control of media objects (stored with the object and sent by GET /media/*). */
export const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Lets a browser display the image when the URL is opened directly (Firefox applies the CSP to
 * its image document too), without any scripts.
 */
export const MEDIA_CONTENT_SECURITY_POLICY = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";

/** Content types GET /media/* may serve, by file extension (raster images only — no SVG / HTML). */
export const MEDIA_CONTENT_TYPES: Readonly<Record<string, string>> = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
};

/** At most this many "/"-separated segments in a served key. */
export const MAX_MEDIA_KEY_SEGMENTS = 8;
/**
 * Longest key segment / whole key the storage accepts (bytes; served keys are ASCII). MinIO answers
 * 400 XMinioInvalidObjectName to a longer segment and S3 rejects keys over 1024 bytes — such
 * requests must end as a 404, not as a storage error.
 */
export const MAX_MEDIA_KEY_SEGMENT_LENGTH = 255;
export const MAX_MEDIA_KEY_LENGTH = 1024;

/** 15 MB per uploaded file. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
/** The same limit in whole megabytes, for messages («Файл больше 15 МБ»). */
export const MAX_UPLOAD_MEGABYTES = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);
/** Longest side after processing (px). Smaller images are never upscaled. */
export const MAX_IMAGE_DIMENSION = 2400;
/**
 * Decompression-bomb guard: refuse inputs above 40 megapixels (≈160 MB of decoded RGBA — still far
 * above any camera photo that fits into the upload limit).
 */
export const MAX_INPUT_PIXELS = 40_000_000;
/** WebP quality of the stored image. */
export const WEBP_QUALITY = 82;
/** WebP encoder effort, 0 (fast) … 6 (smallest file): sharp's default balance. */
export const WEBP_EFFORT = 4;
/** Sharp jobs running at once; further uploads wait in a FIFO queue (memory of the VPS). */
export const MAX_CONCURRENT_IMAGE_JOBS = 2;
/** libvips worker threads per image (default = all CPU cores). */
export const IMAGE_THREADS = 2;
/** Longest original file name kept for display. */
export const MAX_ORIGINAL_NAME_LENGTH = 200;
