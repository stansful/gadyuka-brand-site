import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { SEED_CONTENT_IMAGES } from '../data/seed-content-images.constants';
import { SeedMediaKey } from '../data/seed-media-key.enum';
import { ContentImageSeeds } from './content-image-seeds';

describe('ContentImageSeeds (landing image keys → seed images)', () => {
  const seeds = new ContentImageSeeds();

  it('has a seed image for every landing image key, and none for a key the site does not have', () => {
    deepStrictEqual(Object.keys(SEED_CONTENT_IMAGES).sort(), [...seeds.keys()].sort());
    for (const key of seeds.keys()) {
      strictEqual(typeof seeds.findSeedImage(key), 'string', key);
    }
  });

  it('shows the black hoodie in «О нас» and the pattern rack in «Индивидуальный пошив»', () => {
    deepStrictEqual(
      ['about.image', 'tailoring.image'].map(key => seeds.findSeedImage(key)),
      [SeedMediaKey.HOODIE_BLACK_BACK, SeedMediaKey.LEKALA_RACK],
    );
    strictEqual(seeds.findSeedImage('hero.image'), undefined);
  });
});
