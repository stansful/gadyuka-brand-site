/**
 * Media object keys and public URLs (pure and isomorphic: no Node / SDK imports, so the seed,
 * route handlers and client components can all use it).
 *
 * - Every upload gets its own folder in the bucket:
 *     key = "<admin|user>/<ownerId>/<uuid>/image.webp"
 *   (the layout is also a CHECK constraint on Media.key in the migration). The uuid is new for
 *   every upload, so an object is never rewritten in place.
 * - Public URL = MEDIA_URL_PREFIX + "/" + key, e.g. "/media/admin/<ownerId>/<uuid>/image.webp":
 *   same-origin, served by the route handler src/app/media/[...key]/route.ts (streams the object
 *   from S3) — also the upstream of next/image (images.localPatterns in next.config.ts).
 *   Stored as Media.url and used as-is by the site and the admin.
 * - Because keys are immutable, objects and responses are cached for a year (MEDIA_CACHE_CONTROL).
 */

import type { UserRole } from '@/generated/prisma/enums';

export const MEDIA_URL_PREFIX = '/media';

/** File name of the single optimized WebP stored per upload. */
export const MEDIA_FILE_NAME = 'image.webp';
export const MEDIA_MIME = 'image/webp';

/** Cache-Control of media objects (stored on the object and sent by the /media route). */
export const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Content types the /media route may serve, by file extension (raster images only — no SVG / HTML). */
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
 * Longest key segment / whole key the storage accepts (bytes; served keys are ASCII, so also
 * characters). MinIO answers 400 XMinioInvalidObjectName to a longer segment and S3 rejects keys
 * over 1024 bytes — such requests must end as a 404 here, not as a storage error. Real keys are
 * far below both (an owner id of at most 128 characters, a uuid of 36).
 */
export const MAX_MEDIA_KEY_SEGMENT_LENGTH = 255;
export const MAX_MEDIA_KEY_LENGTH = 1024;

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
/** User.id (cuid) or any other id that is a single safe path segment. */
const OWNER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
/** RFC 4122 shape, lowercase (Postgres prints uuid in lowercase — the key CHECK compares text). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type MediaKeyParts = {
  /** Owner's role — the first key segment, lowercased ("admin" / "user") */
  ownerType: UserRole;
  /** User.id of the owner */
  ownerId: string;
  /** Media.uuid: the per-upload folder */
  uuid: string;
};

/** { ADMIN, "ck…", "3f2b…" } → "admin/ck…/3f2b…/image.webp". Throws on an unsafe owner id or uuid. */
export function mediaObjectKey({ ownerType, ownerId, uuid }: MediaKeyParts): string {
  const role = ownerType.toLowerCase();
  if (role !== 'admin' && role !== 'user') throw new Error(`Invalid media owner type: ${ownerType}`);
  if (!OWNER_ID.test(ownerId)) throw new Error('Invalid media owner id');
  const folder = uuid.toLowerCase();
  if (!UUID.test(folder)) throw new Error('Invalid media uuid');
  return `${role}/${ownerId}/${folder}/${MEDIA_FILE_NAME}`;
}

/** "admin/ck…/3f2b…/image.webp" → "/media/admin/ck…/3f2b…/image.webp" (each segment URI-encoded). */
export function mediaPublicUrl(key: string): string {
  const encoded = key
    .replace(/\\/g, '/')
    .split('/')
    .filter(segment => segment.length > 0)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `${MEDIA_URL_PREFIX}/${encoded}`;
}

/** Lowercase extension of the last segment ("image.WEBP" → "webp"), "" when there is none. */
function extensionOf(segment: string): string {
  const dot = segment.lastIndexOf('.');
  return dot > 0 ? segment.slice(dot + 1).toLowerCase() : '';
}

/**
 * Validates the decoded segments of a /media/<key> request and returns the object key, or null:
 * 1..8 segments of [A-Za-z0-9._-] (no "..", no hidden "." segments, no empty ones) of at most
 * 255 characters, at most 1024 in all, ending in a served raster image extension. Nothing else
 * is ever looked up in the bucket, and every key that passes is a valid object name.
 */
export function parseMediaKey(segments: readonly string[]): string | null {
  if (segments.length === 0 || segments.length > MAX_MEDIA_KEY_SEGMENTS) return null;
  for (const segment of segments) {
    if (segment.length > MAX_MEDIA_KEY_SEGMENT_LENGTH) return null;
    if (!SAFE_SEGMENT.test(segment) || segment.startsWith('.')) return null;
  }
  const last = segments[segments.length - 1] ?? '';
  if (!MEDIA_CONTENT_TYPES[extensionOf(last)]) return null;
  const key = segments.join('/');
  return key.length > MAX_MEDIA_KEY_LENGTH ? null : key;
}

/** Content type for a served key by its extension (keys passed parseMediaKey always have one). */
export function mediaContentTypeForKey(key: string): string {
  return MEDIA_CONTENT_TYPES[extensionOf(key.slice(key.lastIndexOf('/') + 1))] ?? 'application/octet-stream';
}

/** True for a content type the /media route may send as is (an allowed raster image type). */
export function isServedMediaContentType(value: string | undefined): value is string {
  if (!value) return false;
  const type = value.split(';')[0]?.trim().toLowerCase() ?? '';
  return Object.values(MEDIA_CONTENT_TYPES).includes(type);
}
