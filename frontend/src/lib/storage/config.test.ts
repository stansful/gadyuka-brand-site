import { describe, expect, it } from 'vitest';

import { parseS3Config, S3ConfigError } from './config';

const DEV_ENV = {
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'gadyuka-media',
  S3_ACCESS_KEY_ID: 'gadyuka',
  S3_SECRET_ACCESS_KEY: 'gadyuka-minio',
  S3_FORCE_PATH_STYLE: '1',
};

describe('parseS3Config', () => {
  it('reads the S3_* variables', () => {
    expect(parseS3Config(DEV_ENV)).toEqual({
      endpoint: 'http://127.0.0.1:9000',
      region: 'us-east-1',
      bucket: 'gadyuka-media',
      accessKeyId: 'gadyuka',
      secretAccessKey: 'gadyuka-minio',
      forcePathStyle: true,
    });
  });

  it('defaults the region and path-style addressing (MinIO), and reads 0 / false', () => {
    const config = parseS3Config({ ...DEV_ENV, S3_REGION: '', S3_FORCE_PATH_STYLE: undefined });
    expect(config.region).toBe('us-east-1');
    expect(config.forcePathStyle).toBe(true);
    expect(parseS3Config({ ...DEV_ENV, S3_FORCE_PATH_STYLE: '0' }).forcePathStyle).toBe(false);
    expect(parseS3Config({ ...DEV_ENV, S3_FORCE_PATH_STYLE: 'false' }).forcePathStyle).toBe(false);
  });

  it('names missing or invalid variables without echoing secret values', () => {
    const attempt = (): unknown =>
      parseS3Config({ ...DEV_ENV, S3_ENDPOINT: 'ftp://minio', S3_BUCKET: 'Bad_Bucket', S3_SECRET_ACCESS_KEY: '' });
    expect(attempt).toThrow(S3ConfigError);
    expect(attempt).toThrow(/S3_ENDPOINT, S3_BUCKET, S3_SECRET_ACCESS_KEY/);
    const thrown = ((): unknown => {
      try {
        return parseS3Config({ ...DEV_ENV, S3_ACCESS_KEY_ID: undefined });
      } catch (error: unknown) {
        return error;
      }
    })();
    expect(thrown).toBeInstanceOf(S3ConfigError);
    expect(String(thrown)).toContain('S3_ACCESS_KEY_ID');
    expect(String(thrown)).not.toContain('gadyuka-minio');
  });
});
