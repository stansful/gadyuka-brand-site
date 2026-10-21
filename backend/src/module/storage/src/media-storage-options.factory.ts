import { Injectable } from '@nestjs/common';
import { S3Credentials, S3Disk, StorageModuleOptions, StorageOptionsFactory } from '@nestjs/storage';

import { ConfigService } from '~config';

import { MEDIA_DISK } from './storage.constants';

/**
 * The media disk: S3 (MinIO) over fetch, no AWS SDK. The bucket is private — files reach browsers
 * only through GET /media/* of this backend. Credentials are the backend's own MinIO user.
 */
@Injectable()
export class MediaStorageOptionsFactory implements StorageOptionsFactory {
  /** Per-attempt S3 timeout: the site must not hang on a stuck storage. */
  private static readonly TIMEOUT = '30s';

  constructor(private readonly config: ConfigService) {}

  createStorageOptions(): StorageModuleOptions {
    return { default: MEDIA_DISK, disks: { [MEDIA_DISK]: this.createMediaDisk() } };
  }

  private createMediaDisk(): S3Disk {
    return new S3Disk({
      endpoint: this.config.getSafety('S3_ENDPOINT'),
      region: this.config.getSafety('S3_REGION'),
      bucket: this.config.getSafety('S3_BUCKET'),
      forcePathStyle: this.config.getSafety('S3_FORCE_PATH_STYLE'),
      credentials: this.credentials(),
      timeout: MediaStorageOptionsFactory.TIMEOUT,
    });
  }

  private credentials(): S3Credentials {
    return {
      accessKeyId: this.config.getSafety('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.config.getSafety('S3_SECRET_ACCESS_KEY'),
    };
  }
}
