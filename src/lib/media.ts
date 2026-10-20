import 'server-only';
import { randomUUID } from 'node:crypto';

import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

import type { UserRole } from '@/generated/prisma/enums';
import {
  isAcceptedImageMime,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  type AcceptedImageMime,
} from '@/lib/admin/media-constants';
import { deleteObject, getMediaBucket, putObject } from '@/lib/storage';
import { MEDIA_CACHE_CONTROL, MEDIA_MIME, mediaObjectKey, mediaPublicUrl } from '@/lib/storage/keys';

/**
 * Image upload pipeline (server-only, no DB access — see src/lib/admin/media-service.ts):
 *
 *   validate size → detect type by magic bytes (file-type) → sharp: auto-orient,
 *   fit inside 2400×2400 (no upscaling), strip metadata (EXIF/GPS), encode WebP →
 *   PutObject to S3 as <admin|user>/<ownerId>/<uuid>/image.webp (src/lib/storage)
 *
 * The key is built from the owner and a fresh random uuid (never from user input), so every
 * upload gets its own folder and an object is never overwritten; the /media/<key> URL is
 * cached immutably.
 */

export {
  ACCEPTED_IMAGE_MIME,
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  type AcceptedImageMime,
} from '@/lib/admin/media-constants';

/**
 * Decompression-bomb guard: refuse inputs above 40 megapixels (≈160 MB of decoded RGBA —
 * still far above any camera photo that fits into the 15 MB upload limit).
 */
export const MAX_INPUT_PIXELS = 40_000_000;
const WEBP_QUALITY = 82;

/**
 * At most this many sharp jobs run at once (each may hold a large decoded image); further
 * uploads wait in a FIFO queue, so parallel uploads cannot exhaust the VPS memory.
 */
export const MAX_CONCURRENT_IMAGE_JOBS = 2;
/** libvips worker threads per image (default = all CPU cores). */
sharp.concurrency(2);

let activeImageJobs = 0;
const waitingImageJobs: Array<() => void> = [];

/** Runs `job` when an image-processing slot is free (slots are handed over FIFO). */
export async function withImageJobSlot<T>(job: () => Promise<T>): Promise<T> {
  if (activeImageJobs < MAX_CONCURRENT_IMAGE_JOBS) {
    activeImageJobs += 1;
  } else {
    // The releasing job hands its slot over directly (activeImageJobs stays the same).
    await new Promise<void>(resolve => waitingImageJobs.push(resolve));
  }
  try {
    return await job();
  } finally {
    const next = waitingImageJobs.shift();
    if (next) next();
    else activeImageJobs -= 1;
  }
}

/** Why an upload was refused — the admin shows admin.media.errors.<code> (messages/admin/ru.json). */
export type MediaValidationCode = 'empty' | 'tooLarge' | 'unsupported' | 'processingFailed';

const VALIDATION_LOG_MESSAGES: Readonly<Record<MediaValidationCode, string>> = {
  empty: 'empty file',
  tooLarge: `file larger than ${MAX_UPLOAD_BYTES} bytes`,
  unsupported: 'unsupported image format',
  processingFailed: 'image could not be processed (corrupt or too large)',
};

/**
 * Validation / processing failure of an upload. `code` is what the user is told (translated
 * by the caller); the English message is for logs and the seed.
 */
export class MediaValidationError extends Error {
  readonly code: MediaValidationCode;

  constructor(code: MediaValidationCode) {
    super(VALIDATION_LOG_MESSAGES[code]);
    this.name = 'MediaValidationError';
    this.code = code;
  }
}

export type ProcessedImage = {
  data: Buffer;
  width: number;
  height: number;
  mime: typeof MEDIA_MIME;
  size: number;
  sourceMime: AcceptedImageMime;
};

/** MIME type by magic bytes, or null when the file is not an accepted raster image. */
export async function detectImageMime(data: Uint8Array): Promise<AcceptedImageMime | null> {
  const detected = await fileTypeFromBuffer(data);
  if (!detected) return null;
  return isAcceptedImageMime(detected.mime) ? detected.mime : null;
}

/** Validates and converts an uploaded image to WebP. Throws MediaValidationError. */
export async function processImage(data: Uint8Array): Promise<ProcessedImage> {
  if (data.byteLength === 0) throw new MediaValidationError('empty');
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new MediaValidationError('tooLarge');
  const sourceMime = await detectImageMime(data);
  if (!sourceMime) throw new MediaValidationError('unsupported');

  try {
    const { data: output, info } = await withImageJobSlot(() =>
      sharp(data, {
        limitInputPixels: MAX_INPUT_PIXELS,
        failOn: 'error',
        // Animated GIF/WebP: only the first frame is kept (the site shows still images).
        animated: false,
      })
        .autoOrient()
        .resize({
          width: MAX_IMAGE_DIMENSION,
          height: MAX_IMAGE_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer({ resolveWithObject: true }),
    );

    return {
      data: output,
      width: info.width,
      height: info.height,
      mime: MEDIA_MIME,
      size: output.byteLength,
      sourceMime,
    };
  } catch (error: unknown) {
    console.warn('[media] sharp failed to process an upload:', error instanceof Error ? error.message : error);
    throw new MediaValidationError('processingFailed');
  }
}

/**
 * Original file name for display only (never part of a storage key): no directories,
 * no control characters, NFC, at most 200 characters.
 */
export function sanitizeOriginalName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFC')
    // oxlint-disable-next-line eslint/no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const limited = cleaned.length > 200 ? cleaned.slice(cleaned.length - 200) : cleaned;
  return limited.length > 0 ? limited : 'image';
}

/** Who owns an upload (the first two segments of its S3 key). */
export type MediaOwner = { ownerType: UserRole; ownerId: string };

/** Where a stored image lives — the Media row fields besides the image metadata. */
export type StoredImage = { uuid: string; bucket: string; key: string; url: string };

/**
 * Uploads a processed image into a new per-upload folder,
 * "<admin|user>/<ownerId>/<uuid>/image.webp" (immutable: the uuid is never reused).
 */
export async function storeProcessedImage(
  image: ProcessedImage,
  owner: MediaOwner,
  uuid: string = randomUUID(),
): Promise<StoredImage> {
  const key = mediaObjectKey({ ownerType: owner.ownerType, ownerId: owner.ownerId, uuid });
  await putObject({ key, body: image.data, contentType: image.mime, cacheControl: MEDIA_CACHE_CONTROL });
  return { uuid, bucket: getMediaBucket(), key, url: mediaPublicUrl(key) };
}

/** Deletes a stored image (Media.bucket + Media.key). A missing object is not an error. */
export async function removeStoredImage(stored: { bucket: string; key: string }): Promise<void> {
  await deleteObject(stored.key, stored.bucket);
}
