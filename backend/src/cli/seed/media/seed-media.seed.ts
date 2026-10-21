import { Injectable, Logger } from '@nestjs/common';

import { MediaStorage } from '~module/storage';

import { AdminUserRepository } from '../admin-user.repository';
import { ContentImageSeedRepository } from '../content-images/content-image-seed.repository';
import { ContentImageSeeds } from '../content-images/content-image-seeds';
import { SEED_MEDIA_KEYS, SeedMediaKey } from '../data/seed-media-key.enum';
import { SeedRun } from '../run/seed-run';
import { SeedScope } from '../run/seed-scope.enum';
import { SeedStep } from '../seed-step.interface';
import { SeedMediaImporter } from './seed-media.importer';
import { SeedMediaStats } from './seed-media.stats';
import { SeedOwnerMissingError } from './seed-owner-missing.error';

/**
 * Seed images (backend/assets → WebP → MinIO + Media rows, owned by the primary ADMIN): every image on a
 * full run; on a seeded database only the images of content image keys without a row (new keys after a
 * code update). One image at a time: each encode holds a full-size decoded image. Never writes alt texts.
 */
@Injectable()
export class SeedMediaSeed implements SeedStep {
  private readonly logger = new Logger(SeedMediaSeed.name);
  private readonly neededKeys: Readonly<Record<SeedScope, () => Promise<SeedMediaKey[]>>>;

  constructor(
    private readonly seedRun: SeedRun,
    private readonly contentImages: ContentImageSeedRepository,
    private readonly contentImageSeeds: ContentImageSeeds,
    private readonly admins: AdminUserRepository,
    private readonly storage: MediaStorage,
    private readonly importer: SeedMediaImporter,
  ) {
    this.neededKeys = {
      [SeedScope.FULL]: async () => [...SEED_MEDIA_KEYS],
      [SeedScope.NEW_IMAGE_KEYS]: () => this.findImagesOfNewContentKeys(),
    };
  }

  async run(): Promise<void> {
    const keys = await this.neededKeys[this.seedRun.scope()]();
    if (keys.length === 0) {
      this.logger.log('SeedMediaSeed : no new images needed');
      return;
    }
    await this.storage.assertAvailable();
    const stats = await this.importAll(keys);
    this.logger.log('SeedMediaSeed : media', { images: keys.length, ...stats.toLogContext() });
  }

  /** One image at a time: each encode holds a full-size decoded image. */
  private async importAll(keys: readonly SeedMediaKey[]): Promise<SeedMediaStats> {
    const ownerId = await this.findOwnerId();
    const stats = new SeedMediaStats();
    for (const key of keys) {
      this.seedRun.recordMedia(key, await this.importer.import({ key, ownerId }, stats));
    }
    return stats;
  }

  /** Seed images of the content image keys without a row, in the order of the keys (each once). */
  private async findImagesOfNewContentKeys(): Promise<SeedMediaKey[]> {
    const existing = await this.contentImages.findExistingKeys();
    const missing = this.contentImageSeeds.keys().filter(key => !existing.has(key));
    const images = missing.flatMap(key => this.contentImageSeeds.findSeedImage(key) ?? []);
    return [...new Set(images)];
  }

  private async findOwnerId(): Promise<string> {
    const admin = await this.admins.findPrimaryAdmin();
    if (admin === null) {
      throw new SeedOwnerMissingError();
    }
    return admin.id;
  }
}
