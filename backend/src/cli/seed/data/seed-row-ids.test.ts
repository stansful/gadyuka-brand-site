import { match, notStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { SeedRowIds } from './seed-row-ids';

const UUID_V7 = /^0199f2c4-0000-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('SeedRowIds (ids of demo rows without a natural key)', () => {
  const ids = new SeedRowIds();

  it('derives the same UUID v7-shaped id from a seed row name on every run', () => {
    const id = ids.idOf('seed-review-1');
    match(id, UUID_V7);
    strictEqual(new SeedRowIds().idOf('seed-review-1'), id);
  });

  it('keeps the ids of the rows seeded before (golden value: re-runs upsert, never duplicate)', () => {
    strictEqual(ids.idOf('seed-review-1'), '0199f2c4-0000-73d3-8131-23b36f603fd4');
  });

  it('gives every name its own id', () => {
    notStrictEqual(ids.idOf('seed-review-1'), ids.idOf('seed-review-2'));
    notStrictEqual(ids.idOf('seed-menu-home'), ids.idOf('seed-menu-catalog'));
  });
});
