/**
 * Seed media → S3 (MinIO). CONTRACT shared by the seed orchestrator (prisma/seed.ts) and the
 * media storage layer — keep the exported signature stable.
 *
 * For every image: source (assets/…) → sharp (rotate, fit inside 2400×2400, WebP q84 effort 5)
 * → S3 object `admin/<ownerId>/<uuid>/image.webp` → Media row (upserted by uuid).
 *
 * Identity: the uuid is DERIVED, not random —
 *   uuid = sha256("gadyuka-seed:" + seedKey + ":" + sha256(ENCODING_SIGNATURE + source bytes))
 * formatted as an RFC 4122-shaped UUID with version 8 ("custom"; admin uploads use random v4).
 * So a re-run finds the same row and object (nothing is duplicated or re-uploaded), while a
 * changed source file or changed encoding settings give a NEW uuid — a new immutable URL
 * (/media/* is cached for a year, an object is never rewritten in place).
 *
 * Re-runs when the content of a seedKey changed (an edited asset):
 *  - overwrite = false: the existing row for that image (same ownerId + originalName, made by
 *    the seed — uuid version 8) keeps being used: the admin may reference it; nothing new is
 *    uploaded. With no such row, the current content is uploaded and a row created.
 *  - overwrite = true (SEED_OVERWRITE=1): the row for the CURRENT content is created/refreshed
 *    and returned; the orchestrator re-points entity references at it. Older rows are left in
 *    the media library (the admin can delete them once unused).
 * Media.alt is never written here (new rows get the column default `{}`): the caller sets alt
 * texts. Plain tsx (no "server-only"): uses the pure storage modules in src/lib/storage.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import type { PrismaClient } from '@/generated/prisma/client';

import { parseS3Config } from '@/lib/storage/config';
import { MEDIA_CACHE_CONTROL, MEDIA_MIME, mediaObjectKey, mediaPublicUrl } from '@/lib/storage/keys';
import { createS3Client, ensureBucket, headObject, putObject, type S3Storage } from '@/lib/storage/s3';

export type SeedImageInput = {
  /** Stable seed identity, e.g. "hoodieWhiteLogo" */
  seedKey: string;
  /** Source image, relative to the project root (assets/ is read-only) */
  sourcePath: string;
};

export type SeedMediaOptions = {
  /** Id of the ADMIN user that owns seed uploads (first segment pair of the S3 key: admin/<ownerId>/…) */
  ownerId: string;
  /** SEED_OVERWRITE=1: re-point rows at freshly encoded files */
  overwrite: boolean;
};

const MAX_DIMENSION = 2400;
const WEBP_QUALITY = 84;
const WEBP_EFFORT = 5;

/** Encoding settings are part of the content hash: changing them yields new uuids (new URLs). */
export const SEED_ENCODING_SIGNATURE = `webp:q${WEBP_QUALITY}:e${WEBP_EFFORT}:max${MAX_DIMENSION}:rotate:v1`;

/** sha256(signature + source bytes), hex. */
export function seedContentHash(source: Uint8Array, signature: string = SEED_ENCODING_SIGNATURE): string {
  return createHash('sha256').update(signature).update(source).digest('hex');
}

/**
 * Deterministic Media.uuid of a seed image: sha256("gadyuka-seed:<seedKey>:<contentHash>"), first
 * 16 bytes as a lowercase RFC 4122-shaped UUID (version 8, variant 10xx).
 */
export function seedMediaUuid(seedKey: string, contentHash: string): string {
  const bytes = createHash('sha256').update(`gadyuka-seed:${seedKey}:${contentHash}`).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Made by this seed (seedMediaUuid → version 8), not uploaded in the admin (random v4). */
export function isSeedMediaUuid(uuid: string): boolean {
  return uuid.charAt(14) === '8';
}

type EncodedImage = { data: Buffer; width: number; height: number; size: number };

async function encode(source: Buffer): Promise<EncodedImage> {
  const { data, info } = await sharp(source)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, size: data.byteLength };
}

const existingRowSelect = { id: true, key: true, bucket: true } as const;

type SeedStats = { uploaded: number; created: number; reused: number; kept: number };

async function seedOne(
  prisma: PrismaClient,
  storage: S3Storage,
  image: SeedImageInput,
  options: SeedMediaOptions,
  stats: SeedStats,
): Promise<string> {
  const source = await readFile(path.resolve(process.cwd(), image.sourcePath));
  const uuid = seedMediaUuid(image.seedKey, seedContentHash(source));
  const originalName = path.basename(image.sourcePath);

  const current = await prisma.media.findUnique({ where: { uuid }, select: existingRowSelect });
  if (current) {
    // Same seedKey + same content: reuse; only restore the object if the bucket lost it.
    if (current.bucket === storage.bucket && !(await headObject(storage, current.key))) {
      const encoded = await encode(source);
      await putObject(storage, {
        key: current.key,
        body: encoded.data,
        contentType: MEDIA_MIME,
        cacheControl: MEDIA_CACHE_CONTROL,
      });
      stats.uploaded += 1;
    }
    stats.reused += 1;
    return current.id;
  }

  if (!options.overwrite) {
    // The asset changed since an earlier seed: keep the row the site (and maybe the admin) uses.
    const previous = await prisma.media.findMany({
      where: { ownerId: options.ownerId, originalName },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { ...existingRowSelect, uuid: true },
    });
    const seeded = previous.find(row => isSeedMediaUuid(row.uuid));
    if (seeded) {
      if (seeded.bucket === storage.bucket && !(await headObject(storage, seeded.key))) {
        console.warn(
          `  media ${image.seedKey}: object ${seeded.key} is missing and its source changed — re-seed with SEED_OVERWRITE=1`,
        );
      }
      stats.kept += 1;
      return seeded.id;
    }
  }

  const key = mediaObjectKey({ ownerType: 'ADMIN', ownerId: options.ownerId, uuid });
  const encoded = await encode(source);
  const stored = await headObject(storage, key);
  if (!stored) {
    await putObject(storage, { key, body: encoded.data, contentType: MEDIA_MIME, cacheControl: MEDIA_CACHE_CONTROL });
    stats.uploaded += 1;
  }
  const fileFields = {
    bucket: storage.bucket,
    key,
    url: mediaPublicUrl(key),
    mime: MEDIA_MIME,
    width: encoded.width,
    height: encoded.height,
    // An object kept from an earlier run (e.g. the database was reset, MinIO was not) may come
    // from another libvips build: its stored size wins.
    size: stored?.contentLength ?? encoded.size,
    originalName,
  };
  const row = await prisma.media.upsert({
    where: { uuid },
    create: { ownerType: 'ADMIN', ownerId: options.ownerId, uuid, ...fileFields },
    update: fileFields,
    select: { id: true },
  });
  stats.created += 1;
  return row.id;
}

/**
 * Ensures the bucket exists, encodes every source to WebP (≤2400 px), uploads it to S3 under
 * `admin/<ownerId>/<uuid>/image.webp` and upserts its Media row (bucket, key, url, mime, size…).
 * Re-runs reuse existing rows/objects (no duplicates). Never touches Media.alt — the caller
 * sets alt texts. Returns the Media id for every requested seedKey.
 */
export async function seedMedia(
  prisma: PrismaClient,
  images: readonly SeedImageInput[],
  options: SeedMediaOptions,
): Promise<Record<string, string>> {
  const config = parseS3Config();
  const storage: S3Storage = { client: createS3Client(config), bucket: config.bucket };
  const stats: SeedStats = { uploaded: 0, created: 0, reused: 0, kept: 0 };
  try {
    await ensureBucket(storage);
    const ids: Record<string, string> = {};
    // One at a time: each encode holds a full-size decoded image.
    for (const image of images) {
      ids[image.seedKey] = await seedOne(prisma, storage, image, options, stats);
    }
    console.log(
      `  media: ${images.length} images → bucket "${storage.bucket}" (${stats.created} rows created/refreshed, ` +
        `${stats.reused} reused, ${stats.kept} kept at an older version, ${stats.uploaded} objects uploaded)`,
    );
    return ids;
  } finally {
    storage.client.destroy();
  }
}
