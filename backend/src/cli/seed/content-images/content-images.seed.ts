import { Injectable, Logger } from '@nestjs/common';

import { SeedMode } from '../run/seed-mode.enum';
import { SeedOptions } from '../run/seed-options';
import { SeedRun } from '../run/seed-run';
import { SeedStep } from '../seed-step.interface';
import { ContentImageLink, ContentImageSeedRepository } from './content-image-seed.repository';
import { ContentImageSeeds } from './content-image-seeds';

/**
 * Landing images (content_images, key → Media): every key gets a row with its seed image. Existing rows
 * are left alone (the admin may have picked another photo or none); SEED_OVERWRITE=1 points them back at
 * the seed image.
 */
@Injectable()
export class ContentImagesSeed implements SeedStep {
  private readonly logger = new Logger(ContentImagesSeed.name);
  private readonly writeExisting: Readonly<Record<SeedMode, (link: ContentImageLink) => Promise<void>>>;

  constructor(
    private readonly options: SeedOptions,
    private readonly seedRun: SeedRun,
    private readonly repository: ContentImageSeedRepository,
    private readonly contentImageSeeds: ContentImageSeeds,
  ) {
    this.writeExisting = {
      [SeedMode.KEEP_EDITS]: async () => undefined,
      [SeedMode.OVERWRITE]: link => this.repository.updateMedia(link),
    };
  }

  async run(): Promise<void> {
    const existing = await this.repository.findExistingKeys();
    const links = this.contentImageSeeds.keys().map(key => this.linkOf(key));
    for (const link of links) {
      await (existing.has(link.key) ? this.writeExisting[this.options.mode()](link) : this.repository.create(link));
    }
    const created = links.filter(link => !existing.has(link.key)).length;
    this.logger.log('ContentImagesSeed : content images', { keys: links.length, created, mode: this.options.mode() });
  }

  private linkOf(key: string): ContentImageLink {
    const image = this.contentImageSeeds.findSeedImage(key);
    const mediaId = image === undefined ? undefined : this.seedRun.findMediaId(image);
    return { key, mediaId: mediaId ?? null };
  }
}
