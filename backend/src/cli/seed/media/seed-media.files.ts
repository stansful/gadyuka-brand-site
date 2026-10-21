import { Injectable } from '@nestjs/common';

import { EncodedSeedImage, SeedImageEncoder } from './seed-image.encoder';
import { StoredSeedMedia } from './seed-media.repository';
import { SeedMediaStats } from './seed-media.stats';
import { SeedMediaStore } from './seed-media.store';

/** A seed image object to store at its derived key. */
export interface SeedObject {
  readonly key: string;
  readonly source: Buffer;
}

/** The stored WebP of a seed image: its dimensions and the size of the object in the bucket. */
export interface StoredSeedObject {
  readonly encoded: EncodedSeedImage;
  readonly size: number;
}

/** Encodes seed images and keeps their objects in the bucket (uploads only what is missing). */
@Injectable()
export class SeedMediaFiles {
  constructor(
    private readonly encoder: SeedImageEncoder,
    private readonly store: SeedMediaStore,
  ) {}

  bucket(): string {
    return this.store.bucket();
  }

  /** True when the row lives in the current bucket and its object is gone (another bucket's rows are not checked). */
  async isObjectMissing(row: StoredSeedMedia): Promise<boolean> {
    return row.bucket === this.store.bucket() && (await this.store.findStoredSize(row.key)) === undefined;
  }

  /** Re-uploads the object of an existing row when the bucket lost it (same content: same key). */
  async restoreIfMissing(row: StoredSeedMedia, source: Buffer, stats: SeedMediaStats): Promise<void> {
    if (!(await this.isObjectMissing(row))) {
      return;
    }
    await this.store.put(row.key, (await this.encoder.encode(source)).data);
    stats.countUpload();
  }

  /**
   * Encodes the source and uploads it unless an object is already at the key (e.g. the database was
   * reset, MinIO was not): that object's size wins — it may come from another libvips build.
   */
  async storeObject({ key, source }: SeedObject, stats: SeedMediaStats): Promise<StoredSeedObject> {
    const encoded = await this.encoder.encode(source);
    const storedSize = await this.store.findStoredSize(key);
    if (storedSize !== undefined) {
      return { encoded, size: storedSize };
    }
    await this.store.put(key, encoded.data);
    stats.countUpload();
    return { encoded, size: encoded.size };
  }
}
