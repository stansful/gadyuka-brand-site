import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { SeedUuid } from '../seed-uuid';
import { SEED_ENCODING_SIGNATURE } from './seed-media.constants';

/**
 * Identity of a seed image: its Media.uuid is DERIVED, not random —
 *   uuid = sha256("gadyuka-seed:" + seedKey + ":" + sha256(ENCODING_SIGNATURE + source bytes))
 * formatted as an RFC 4122-shaped UUID with version 8 ("custom"; admin uploads get other versions). A
 * re-run finds the same row and object (nothing is duplicated or re-uploaded), while a changed source
 * file or changed encoding settings give a NEW uuid — a new immutable URL.
 */
@Injectable()
export class SeedMediaIdentity {
  /** UUID version of a seed image ("custom"); admin uploads get other versions. */
  private static readonly VERSION = 8;
  /** Version nibble of a seed uuid as text (character 14 of the canonical form). */
  static readonly SEED_UUID_VERSION = String(SeedMediaIdentity.VERSION);
  private static readonly VERSION_POSITION = 14;
  private static readonly NAMESPACE = 'gadyuka-seed:';
  private readonly uuid = new SeedUuid();

  /** sha256(signature + source bytes), hex. */
  contentHash(source: Uint8Array, signature: string = SEED_ENCODING_SIGNATURE): string {
    return createHash('sha256').update(signature).update(source).digest('hex');
  }

  /** First 16 bytes of sha256("gadyuka-seed:<seedKey>:<contentHash>") as a lowercase v8 UUID (variant 10xx). */
  mediaUuid(seedKey: string, contentHash: string): string {
    const bytes = createHash('sha256').update(`${SeedMediaIdentity.NAMESPACE}${seedKey}:${contentHash}`).digest();
    return this.uuid.format(bytes, SeedMediaIdentity.VERSION);
  }

  /** Made by this seed (version 8), not uploaded in the admin. */
  isSeedMediaUuid(uuid: string): boolean {
    return uuid.charAt(SeedMediaIdentity.VERSION_POSITION) === SeedMediaIdentity.SEED_UUID_VERSION;
  }
}
