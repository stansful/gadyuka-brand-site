import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { isSeedMediaUuid, SEED_ENCODING_SIGNATURE, seedContentHash, seedMediaUuid } from './media';

const RFC4122_V8 = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('seed media identity', () => {
  const source = new TextEncoder().encode('fake jpeg bytes');

  it('derives a stable, lowercase, version-8 uuid from seedKey + content', () => {
    const hash = seedContentHash(source);
    const uuid = seedMediaUuid('hoodieWhiteLogo', hash);
    expect(uuid).toMatch(RFC4122_V8);
    expect(seedMediaUuid('hoodieWhiteLogo', hash)).toBe(uuid);
    expect(isSeedMediaUuid(uuid)).toBe(true);
  });

  it('gives a new uuid (= a new immutable URL) when the source, the encoding or the seedKey changes', () => {
    const uuid = seedMediaUuid('hoodieWhiteLogo', seedContentHash(source));
    expect(seedMediaUuid('hoodieWhiteLogo', seedContentHash(new TextEncoder().encode('edited bytes')))).not.toBe(uuid);
    expect(seedMediaUuid('hoodieWhiteLogo', seedContentHash(source, `${SEED_ENCODING_SIGNATURE}:v2`))).not.toBe(uuid);
    expect(seedMediaUuid('packaging', seedContentHash(source))).not.toBe(uuid);
  });

  it('tells seed rows from admin uploads (random v4 uuids)', () => {
    expect(isSeedMediaUuid(randomUUID())).toBe(false);
  });
});
