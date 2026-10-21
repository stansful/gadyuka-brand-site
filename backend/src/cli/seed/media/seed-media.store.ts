import { Injectable } from '@nestjs/common';
import { InjectDisk, StorageDisk, StorageFileNotFoundError } from '@nestjs/storage';

import { ConfigService } from '~config';
import { MEDIA_CACHE_CONTROL, MEDIA_MIME } from '~core/media/media.constants';
import { MEDIA_DISK } from '~module/storage';

/**
 * Seed image objects on the media disk (MinIO). Unlike admin uploads (MediaStorage.store, a new random
 * folder each time) the seed writes at its derived key, so a re-run finds the object it stored before.
 */
@Injectable()
export class SeedMediaStore {
  constructor(
    @InjectDisk(MEDIA_DISK) private readonly disk: StorageDisk,
    private readonly config: ConfigService,
  ) {}

  /** The bucket of the media disk (Media.bucket of the rows written now). */
  bucket(): string {
    return this.config.getSafety('S3_BUCKET');
  }

  /** Size in bytes of the stored object, undefined when there is none. */
  async findStoredSize(key: string): Promise<number | undefined> {
    try {
      return (await this.disk.stat(key)).size;
    } catch (error: unknown) {
      if (error instanceof StorageFileNotFoundError) {
        return undefined;
      }
      throw error;
    }
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.disk.put(key, data, { contentType: MEDIA_MIME, cacheControl: MEDIA_CACHE_CONTROL });
  }
}
