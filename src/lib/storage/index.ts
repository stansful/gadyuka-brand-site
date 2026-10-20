import 'server-only';
import type { GetObjectResult, S3Storage, StoredObjectInfo } from './s3';

import { parseS3Config } from './config';
import * as s3 from './s3';

/**
 * Media storage for the app (server-only): S3 / MinIO through one lazily created S3Client.
 * The configuration (S3_* variables, src/lib/storage/config.ts) is read on first use, so
 * `next build` and pages that never touch a file do not need it.
 *
 *   import { putObject, getObject } from "@/lib/storage";
 *
 * Pure helpers live next to it: keys/URLs in ./keys (isomorphic), env parsing in ./config,
 * raw operations in ./s3 (also used by the seed, which cannot import "server-only" modules).
 */

export { isMissingObjectError, type GetObjectResult, type S3Storage, type StoredObjectInfo } from './s3';
export { S3ConfigError, type S3Config } from './config';

const globalForStorage = globalThis as typeof globalThis & { __gadyukaStorage?: S3Storage };

/** The configured client + bucket (created on first call; survives dev HMR). Throws S3ConfigError. */
export function getStorage(): S3Storage {
  if (globalForStorage.__gadyukaStorage) return globalForStorage.__gadyukaStorage;
  const config = parseS3Config();
  const storage: S3Storage = { client: s3.createS3Client(config), bucket: config.bucket };
  globalForStorage.__gadyukaStorage = storage;
  return storage;
}

/** Bucket of new uploads (Media.bucket). */
export function getMediaBucket(): string {
  return getStorage().bucket;
}

export function putObject(input: {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
}): Promise<{ etag: string | undefined }> {
  return s3.putObject(getStorage(), input);
}

/** Streams an object (see s3.getObject: the body must be consumed or cancelled). */
export function getObject(key: string, options: { signal?: AbortSignal } = {}): Promise<GetObjectResult> {
  return s3.getObject(getStorage(), key, options);
}

/** Object metadata, or null when it does not exist. */
export function headObject(key: string, options: { signal?: AbortSignal } = {}): Promise<StoredObjectInfo | null> {
  return s3.headObject(getStorage(), key, options);
}

/** Deletes an object (missing = fine). `bucket` defaults to the configured one (pass Media.bucket). */
export function deleteObject(key: string, bucket?: string): Promise<void> {
  const storage = getStorage();
  return s3.deleteObject(bucket ? { client: storage.client, bucket } : storage, key);
}

/** Creates the configured bucket if needed. */
export function ensureBucket(): Promise<void> {
  return s3.ensureBucket(getStorage());
}
