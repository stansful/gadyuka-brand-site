import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';

import type { S3Config } from './config';

/**
 * S3 object operations on an explicit client + bucket. No "server-only" here: the seed
 * (plain tsx, prisma/seed/media.ts) uses these directly with its own client; the app goes
 * through the lazily created singleton in src/lib/storage/index.ts.
 */

export type S3Storage = { client: S3Client; bucket: string };

export function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Fail fast when the storage is down instead of holding page / upload requests open.
    requestHandler: { connectionTimeout: 3_000, requestTimeout: 30_000 },
    maxAttempts: 3,
  });
}

/** Object metadata (HEAD / GET). */
export type StoredObjectInfo = {
  contentType: string | undefined;
  /** Bytes */
  contentLength: number | undefined;
  /** Quoted entity tag as S3 returns it, e.g. "\"5d41…\"" */
  etag: string | undefined;
  lastModified: Date | undefined;
};

export type GetObjectResult =
  | { kind: 'missing' }
  | { kind: 'found'; info: StoredObjectInfo; body: ReadableStream<Uint8Array> };

function httpStatus(error: unknown): number | undefined {
  return error instanceof S3ServiceException ? error.$metadata.httpStatusCode : undefined;
}

/**
 * The OBJECT does not exist (GetObject → NoSuchKey, HeadObject → NotFound). A missing BUCKET
 * (NoSuchBucket) is a configuration error, not a missing file — it is not matched here (HEAD
 * responses carry no error body, so HeadObject cannot tell the two apart: both are NotFound).
 */
export function isMissingObjectError(error: unknown): boolean {
  if (!(error instanceof S3ServiceException)) return false;
  if (error.name === 'NoSuchKey' || error.name === 'NotFound') return true;
  return error.$metadata.httpStatusCode === 404 && error.name !== 'NoSuchBucket';
}

export async function putObject(
  storage: S3Storage,
  input: { key: string; body: Uint8Array; contentType: string; cacheControl?: string },
): Promise<{ etag: string | undefined }> {
  const output = await storage.client.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: input.key,
      Body: input.body,
      ContentLength: input.body.byteLength,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
    }),
  );
  return { etag: output.ETag };
}

/** Object metadata, or null when the object does not exist. */
export async function headObject(
  storage: S3Storage,
  key: string,
  options: { signal?: AbortSignal } = {},
): Promise<StoredObjectInfo | null> {
  try {
    const output = await storage.client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }), {
      abortSignal: options.signal,
    });
    return {
      contentType: output.ContentType,
      contentLength: output.ContentLength,
      etag: output.ETag,
      lastModified: output.LastModified,
    };
  } catch (error: unknown) {
    if (isMissingObjectError(error)) return null;
    throw error;
  }
}

/**
 * Streams an object. The returned body MUST be consumed or cancelled: it holds a pooled
 * connection. `signal` aborts the request (and the body) when the client goes away.
 */
export async function getObject(
  storage: S3Storage,
  key: string,
  options: { signal?: AbortSignal } = {},
): Promise<GetObjectResult> {
  try {
    const output = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }), {
      abortSignal: options.signal,
    });
    if (!output.Body) throw new Error(`S3 returned no body for ${key}`);
    return {
      kind: 'found',
      info: {
        contentType: output.ContentType,
        contentLength: output.ContentLength,
        etag: output.ETag,
        lastModified: output.LastModified,
      },
      body: output.Body.transformToWebStream(),
    };
  } catch (error: unknown) {
    if (isMissingObjectError(error)) return { kind: 'missing' };
    throw error;
  }
}

/** Deletes an object; deleting a missing one is not an error (S3 semantics). */
export async function deleteObject(storage: S3Storage, key: string): Promise<void> {
  await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
}

/** Creates the bucket when it does not exist yet (private: no bucket policy is set). */
export async function ensureBucket(storage: S3Storage): Promise<void> {
  try {
    await storage.client.send(new HeadBucketCommand({ Bucket: storage.bucket }));
    return;
  } catch (error: unknown) {
    if (httpStatus(error) !== 404) throw error;
  }
  try {
    await storage.client.send(new CreateBucketCommand({ Bucket: storage.bucket }));
  } catch (error: unknown) {
    // Created concurrently (another seed / minio-init) — fine.
    if (error instanceof S3ServiceException && error.name === 'BucketAlreadyOwnedByYou') return;
    throw error;
  }
}
