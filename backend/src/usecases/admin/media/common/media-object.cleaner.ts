import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '~config';
import { MediaStorage } from '~module/storage';

import { MediaObjectRemoval } from './media-object-removal.enum';

/** Where the stored file of a media row lives (Media.bucket + Media.key). */
export interface StoredMediaObject {
  readonly bucket: string;
  readonly key: string;
}

/**
 * Deletes the stored file of a media row once the row is gone (or was never written). A storage
 * failure must not undo that: it is logged with the key and reported as FAILED, never thrown —
 * an unreferenced object in the bucket is harmless, a row pointing at a missing file is not.
 */
@Injectable()
export class MediaObjectCleaner {
  private readonly logger = new Logger(MediaObjectCleaner.name);

  constructor(
    private readonly storage: MediaStorage,
    private readonly config: ConfigService,
  ) {}

  async remove(object: StoredMediaObject): Promise<MediaObjectRemoval> {
    if (object.bucket !== this.config.getSafety('S3_BUCKET')) {
      this.logger.warn('MediaObjectCleaner : the file is in another bucket, left there', { ...object });
      return MediaObjectRemoval.OTHER_BUCKET;
    }
    return this.removeFromDisk(object.key);
  }

  private async removeFromDisk(key: string): Promise<MediaObjectRemoval> {
    try {
      await this.storage.remove(key);
      return MediaObjectRemoval.REMOVED;
    } catch (error: unknown) {
      this.logger.error('MediaObjectCleaner : the file could not be deleted, it stays unreferenced', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return MediaObjectRemoval.FAILED;
    }
  }
}
