import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { SeedUuid } from '../seed-uuid';

/**
 * Ids of the demo rows without a natural unique key (reviews, gallery, offers, partners, menu, social
 * links). The frontend seed used text ids ("seed-review-1"); the backend's ids are UUIDs, so the id is
 * DERIVED from that name — the same row on every run (re-runs upsert instead of duplicating):
 * sha256("gadyuka-seed-row:<name>") in a UUID v7 layout with the fixed timestamp of the seed admin
 * (0199f2c4-0000), so it passes any UUID check of the API.
 */
@Injectable()
export class SeedRowIds {
  private static readonly NAMESPACE = 'gadyuka-seed-row:';
  /** 48-bit unix-ms timestamp of the v7 layout (same as SEED_ADMIN_USER_ID). */
  private static readonly TIMESTAMP = Buffer.from('0199f2c40000', 'hex');
  private static readonly VERSION = 7;
  private readonly uuid = new SeedUuid();

  /** "seed-review-1" → "0199f2c4-0000-7xxx-yxxx-xxxxxxxxxxxx" (lowercase, stable). */
  idOf(name: string): string {
    const bytes = createHash('sha256').update(`${SeedRowIds.NAMESPACE}${name}`).digest();
    SeedRowIds.TIMESTAMP.copy(bytes, 0);
    return this.uuid.format(bytes, SeedRowIds.VERSION);
  }
}
