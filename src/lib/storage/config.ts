import { z } from 'zod';

/**
 * S3 (MinIO) connection settings from the environment (pure: no SDK imports — shared by the
 * app's storage client, src/lib/storage/index.ts, and the seed, prisma/seed/media.ts).
 *
 *   S3_ENDPOINT           http(s) URL of the S3 API (dev: http://127.0.0.1:9000, compose: http://minio:9000)
 *   S3_REGION             default "us-east-1" (MinIO accepts any region)
 *   S3_BUCKET             bucket with the media objects (private: the app serves them under /media)
 *   S3_ACCESS_KEY_ID      the app's access key (in production NOT the MinIO root user)
 *   S3_SECRET_ACCESS_KEY
 *   S3_FORCE_PATH_STYLE   1 = http://host/<bucket>/<key> (MinIO, the default); 0 = virtual-hosted (AWS)
 */

const flagSchema = z
  .enum(['1', '0', 'true', 'false'])
  .optional()
  .transform(value => value === undefined || value === '1' || value === 'true');

/** Empty variables (e.g. "S3_REGION=" in .env) count as missing. */
const optionalText = z.preprocess(value => (value === '' ? undefined : value), z.string().trim().min(1).optional());
const requiredText = z.preprocess(value => (value === '' ? undefined : value), z.string().trim().min(1));

const s3EnvSchema = z.object({
  S3_ENDPOINT: requiredText.pipe(z.url({ protocol: /^https?$/ })),
  S3_REGION: optionalText.transform(value => value ?? 'us-east-1'),
  S3_BUCKET: requiredText.pipe(
    // S3 bucket naming rules (lowercase, digits, dots, hyphens; 3–63 chars).
    z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  ),
  S3_ACCESS_KEY_ID: requiredText,
  S3_SECRET_ACCESS_KEY: requiredText,
  S3_FORCE_PATH_STYLE: z.preprocess(value => (value === '' ? undefined : value), flagSchema),
});

export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

/** Configuration problem; the message names the variables, never their values. */
export class S3ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'S3ConfigError';
  }
}

/** Reads and validates the S3_* variables (default: process.env). Throws S3ConfigError. */
export function parseS3Config(env: Readonly<Record<string, string | undefined>> = process.env): S3Config {
  const parsed = s3EnvSchema.safeParse({
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_REGION: env.S3_REGION,
    S3_BUCKET: env.S3_BUCKET,
    S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
    S3_FORCE_PATH_STYLE: env.S3_FORCE_PATH_STYLE,
  });
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map(issue => String(issue.path[0] ?? '?')))];
    throw new S3ConfigError(
      `S3 media storage is not configured: missing or invalid ${names.join(', ')} (see .env.example, section «S3»)`,
    );
  }
  const data = parsed.data;
  return {
    endpoint: data.S3_ENDPOINT,
    region: data.S3_REGION,
    bucket: data.S3_BUCKET,
    accessKeyId: data.S3_ACCESS_KEY_ID,
    secretAccessKey: data.S3_SECRET_ACCESS_KEY,
    forcePathStyle: data.S3_FORCE_PATH_STYLE,
  };
}
