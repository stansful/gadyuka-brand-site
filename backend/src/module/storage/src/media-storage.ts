import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectDisk, StorageDisk } from '@nestjs/storage';

import { ConfigService } from '~config';
import { MEDIA_CACHE_CONTROL } from '~core/media/media.constants';
import { UserRole } from '~core/users/user-role';

import { MediaKeys } from './media-keys';
import { MEDIA_DISK } from './storage.constants';

/** Who owns an upload (the first two segments of its key). */
export interface MediaOwner {
  readonly ownerType: UserRole;
  readonly ownerId: string;
}

/** A file to store: the bytes and their (detected, never client-declared) content type. */
export interface MediaFile {
  readonly data: Buffer;
  readonly contentType: string;
}

/** Where a stored image lives — the Media row fields besides the image metadata. */
export interface StoredMedia {
  readonly uuid: string;
  readonly bucket: string;
  readonly key: string;
  readonly url: string;
}

/**
 * Media objects on the media disk. Every upload gets a new folder
 * "<admin|user>/<ownerId>/<uuid>/" (the uuid is never reused), so objects are immutable.
 */
@Injectable()
export class MediaStorage {
  constructor(
    @InjectDisk(MEDIA_DISK) private readonly disk: StorageDisk,
    private readonly keys: MediaKeys,
    private readonly config: ConfigService,
  ) {}

  async store(file: MediaFile, owner: MediaOwner): Promise<StoredMedia> {
    const uuid = randomUUID();
    const key = this.keys.buildObjectKey({ ...owner, uuid });
    await this.disk.put(key, file.data, { contentType: file.contentType, cacheControl: MEDIA_CACHE_CONTROL });
    return { uuid, bucket: this.config.getSafety('S3_BUCKET'), key, url: this.keys.buildPublicUrl(key) };
  }

  /** Deletes an object; a missing one is not an error. */
  async remove(key: string): Promise<void> {
    await this.disk.delete(key);
  }

  /** Throws when the bucket cannot be listed (storage down, bucket missing, no permission). */
  async assertAvailable(): Promise<void> {
    await this.disk.list({ limit: 1 });
  }
}
