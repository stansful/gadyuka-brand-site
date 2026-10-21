import { basename } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { MEDIA_MIME } from '~core/media/media.constants';
import { UserRole } from '~core/users/user-role';
import { MediaKeys } from '~module/storage';

import { SeedMediaKey } from '../data/seed-media-key.enum';
import { SEED_MEDIA_SOURCES } from '../data/seed-media.sources';
import { SeedMode } from '../run/seed-mode.enum';
import { SeedOptions } from '../run/seed-options';
import { SeedAssets } from './seed-assets';
import { SeedMediaOutcome } from './seed-media-outcome.enum';
import { SeedMediaFiles, StoredSeedObject } from './seed-media.files';
import { SeedMediaIdentity } from './seed-media.identity';
import { SeedMediaRepository, SeedMediaRow, StoredSeedMedia } from './seed-media.repository';
import { SeedMediaStats } from './seed-media.stats';

/** One seed image to import for an owner (the ADMIN of the S3 key admin/<ownerId>/…). */
export interface SeedImageRequest {
  readonly key: SeedMediaKey;
  readonly ownerId: string;
}

/** A seed image with its source bytes and derived identity. */
interface SeedImage extends SeedImageRequest {
  readonly source: Buffer;
  readonly uuid: string;
  readonly originalName: string;
}

/**
 * One seed image: source (backend/assets) → WebP → object `admin/<ownerId>/<uuid>/image.webp` → Media
 * row (port of the frontend's seedOne). The row of the current content is reused (its object restored if
 * the bucket lost it). When the source changed since an earlier seed:
 * - without SEED_OVERWRITE the older seed row of the same file name keeps being used (the admin may
 *   reference it) and nothing is uploaded; with no such row the current content is stored;
 * - with SEED_OVERWRITE=1 the row of the current content is created and returned (the entities are then
 *   re-pointed at it); older rows stay in the media library.
 */
@Injectable()
export class SeedMediaImporter {
  private readonly logger = new Logger(SeedMediaImporter.name);
  private readonly keptRowOfChangedSource: Readonly<
    Record<SeedMode, (image: SeedImage, stats: SeedMediaStats) => Promise<string | undefined>>
  >;

  constructor(
    private readonly options: SeedOptions,
    private readonly assets: SeedAssets,
    private readonly identity: SeedMediaIdentity,
    private readonly files: SeedMediaFiles,
    private readonly repository: SeedMediaRepository,
    private readonly keys: MediaKeys,
  ) {
    this.keptRowOfChangedSource = {
      [SeedMode.KEEP_EDITS]: (image, stats) => this.findKeptRow(image, stats),
      [SeedMode.OVERWRITE]: async () => undefined,
    };
  }

  /** Returns the Media.id of the image. */
  async import(request: SeedImageRequest, stats: SeedMediaStats): Promise<string> {
    const image = await this.load(request);
    const current = await this.repository.findByUuid(image.uuid);
    if (current !== null) {
      await this.files.restoreIfMissing(current, image.source, stats);
      stats.countRow(SeedMediaOutcome.REUSED);
      return current.id;
    }
    const kept = await this.keptRowOfChangedSource[this.options.mode()](image, stats);
    return kept ?? this.create(image, stats);
  }

  private async load(request: SeedImageRequest): Promise<SeedImage> {
    const path = SEED_MEDIA_SOURCES[request.key];
    const source = await this.assets.read(path);
    const uuid = this.identity.mediaUuid(request.key, this.identity.contentHash(source));
    return { ...request, source, uuid, originalName: basename(path) };
  }

  /** The asset changed since an earlier seed: the row the site (and maybe the admin) uses stays. */
  private async findKeptRow(image: SeedImage, stats: SeedMediaStats): Promise<string | undefined> {
    const uuidVersion = SeedMediaIdentity.SEED_UUID_VERSION;
    const seeded = await this.repository.findLatestOfVersion({ ...image, uuidVersion });
    if (seeded === null) {
      return undefined;
    }
    await this.warnIfObjectMissing(seeded, image.key);
    stats.countRow(SeedMediaOutcome.KEPT);
    return seeded.id;
  }

  /** A kept row whose object is gone cannot be restored (its source changed): only SEED_OVERWRITE=1 helps. */
  private async warnIfObjectMissing(row: StoredSeedMedia, seedKey: SeedMediaKey): Promise<void> {
    if (!(await this.files.isObjectMissing(row))) {
      return;
    }
    this.logger.warn('SeedMediaImporter : object missing and source changed — re-seed with SEED_OVERWRITE=1', {
      seed_key: seedKey,
      key: row.key,
    });
  }

  private async create(image: SeedImage, stats: SeedMediaStats): Promise<string> {
    const key = this.keys.buildObjectKey({ ownerType: UserRole.ADMIN, ownerId: image.ownerId, uuid: image.uuid });
    const stored = await this.files.storeObject({ key, source: image.source }, stats);
    const id = await this.repository.upsert(this.toRow(image, { key, ...stored }));
    stats.countRow(SeedMediaOutcome.CREATED);
    return id;
  }

  private toRow(image: SeedImage, { key, encoded, size }: { key: string } & StoredSeedObject): SeedMediaRow {
    const location = { bucket: this.files.bucket(), key, url: this.keys.buildPublicUrl(key) };
    const file = {
      mime: MEDIA_MIME,
      width: encoded.width,
      height: encoded.height,
      size,
      originalName: image.originalName,
    };
    return { ownerId: image.ownerId, uuid: image.uuid, location, file };
  }
}
