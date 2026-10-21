import { Injectable } from '@nestjs/common';

import { SiteTextRegistry } from '~core/site-texts/site-text-registry';

import { SEED_CONTENT_IMAGES } from '../data/seed-content-images.constants';
import { SeedMediaKey } from '../data/seed-media-key.enum';

/** The landing image keys (SiteTextRegistry, the backend's list) and the seed image of each. */
@Injectable()
export class ContentImageSeeds {
  private readonly registry = new SiteTextRegistry();

  /** Every landing image key, in registry order. */
  keys(): string[] {
    return this.registry.imageKeys();
  }

  /** The seed image of a landing image key (undefined only for a key the seed does not know yet). */
  findSeedImage(key: string): SeedMediaKey | undefined {
    return Object.hasOwn(SEED_CONTENT_IMAGES, key) ? SEED_CONTENT_IMAGES[key] : undefined;
  }
}
