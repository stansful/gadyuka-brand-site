import { Injectable } from '@nestjs/common';

import { SEED_MEDIA_KEYS, SeedMediaKey } from '../data/seed-media-key.enum';
import { SeedMediaMissingError } from './seed-media-missing.error';
import { SeedRunStateError } from './seed-run-state.error';
import { SeedScope } from './seed-scope.enum';

/** A seed image created or reused in this run. */
export interface SeededMedia {
  readonly key: SeedMediaKey;
  readonly mediaId: string;
}

/** Media.id of every seed image, for the demo entities. */
export type SeedMediaIds = Readonly<Record<SeedMediaKey, string>>;

/**
 * State shared by the steps of one `npm run db:seed` (one CLI process): the scope decided before
 * anything is written (SeedScopeSeed) and the Media.id of every seed image of this run (SeedMediaSeed),
 * which the alt texts, the content images and the demo entities point at.
 */
@Injectable()
export class SeedRun {
  private decidedScope: SeedScope | undefined;
  private readonly mediaIds = new Map<SeedMediaKey, string>();

  start(scope: SeedScope): void {
    this.decidedScope = scope;
  }

  scope(): SeedScope {
    if (this.decidedScope === undefined) {
      throw new SeedRunStateError('scope');
    }
    return this.decidedScope;
  }

  recordMedia(key: SeedMediaKey, mediaId: string): void {
    this.mediaIds.set(key, mediaId);
  }

  findMediaId(key: SeedMediaKey): string | undefined {
    return this.mediaIds.get(key);
  }

  /** The seed images of this run, in the order of SEED_MEDIA_KEYS. */
  seededMedia(): SeededMedia[] {
    return SEED_MEDIA_KEYS.flatMap(key => {
      const mediaId = this.mediaIds.get(key);
      return mediaId === undefined ? [] : [{ key, mediaId }];
    });
  }

  /** Every seed image's id; throws when one was not seeded in this run. */
  allMediaIds(): SeedMediaIds {
    const missing = SEED_MEDIA_KEYS.filter(key => !this.mediaIds.has(key));
    if (missing.length > 0) {
      throw new SeedMediaMissingError(missing);
    }
    // Every key was checked above.
    return Object.fromEntries(this.mediaIds) as Record<SeedMediaKey, string>;
  }
}
