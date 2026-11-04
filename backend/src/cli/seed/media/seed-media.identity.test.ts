import { match, notStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import { SEED_ENCODING_SIGNATURE } from './seed-media.constants';
import { SeedMediaIdentity } from './seed-media.identity';

const RFC4122_V8 = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('SeedMediaIdentity (seed media identity)', () => {
  const identity = new SeedMediaIdentity();
  const source = new TextEncoder().encode('fake jpeg bytes');

  it('derives a stable, lowercase, version-8 uuid from seedKey + content', () => {
    const hash = identity.contentHash(source);
    const uuid = identity.mediaUuid('hoodieWhiteLogo', hash);
    match(uuid, RFC4122_V8);
    strictEqual(identity.mediaUuid('hoodieWhiteLogo', hash), uuid);
    strictEqual(identity.isSeedMediaUuid(uuid), true);
  });

  it('gives a new uuid (= a new immutable URL) when the source, the encoding or the seedKey changes', () => {
    const uuid = identity.mediaUuid('hoodieWhiteLogo', identity.contentHash(source));
    const edited = identity.contentHash(new TextEncoder().encode('edited bytes'));
    notStrictEqual(identity.mediaUuid('hoodieWhiteLogo', edited), uuid);
    const reencoded = identity.contentHash(source, `${SEED_ENCODING_SIGNATURE}:v2`);
    notStrictEqual(identity.mediaUuid('hoodieWhiteLogo', reencoded), uuid);
    notStrictEqual(identity.mediaUuid('packaging', identity.contentHash(source)), uuid);
  });

  it('tells seed rows from admin uploads (random v4 / database v7 uuids)', () => {
    strictEqual(identity.isSeedMediaUuid(randomUUID()), false);
    strictEqual(identity.isSeedMediaUuid('0199f2c4-0000-7000-8000-00000000ad01'), false);
  });

  it('derives exactly the uuids of the frontend seed (golden values of prisma/seed/media.ts)', () => {
    strictEqual(SEED_ENCODING_SIGNATURE, 'webp:q95:e5:max2400:rotate:v1');
    const hash = identity.contentHash(source);
    strictEqual(hash, 'c991a155e022973af22054d94a1a75c4c35e0b6c2bfd2f87fa489c85d07ec69a');
    strictEqual(identity.mediaUuid('hoodieWhiteLogo', hash), '631cf436-85ab-846f-ac11-53c92de7f316');
  });
});
