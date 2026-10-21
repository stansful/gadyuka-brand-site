import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { ConfigService } from '~config';
import { TestEnvironment } from '~test/test-environment';

import { SeedMode } from './seed-mode.enum';
import { SeedOptions } from './seed-options';
import { SeedUpdates } from './seed-updates';

const optionsWith = (flag: string | undefined): SeedOptions =>
  new SeedOptions(new ConfigService(TestEnvironment.valid({ SEED_OVERWRITE: flag })));

describe('SeedOptions / SeedUpdates (SEED_OVERWRITE)', () => {
  it('overwrites only with SEED_OVERWRITE=1, like the frontend seed', () => {
    strictEqual(optionsWith('1').mode(), SeedMode.OVERWRITE);
    for (const flag of [undefined, '', '0', 'true', 'yes']) {
      strictEqual(optionsWith(flag).mode(), SeedMode.KEEP_EDITS, String(flag));
    }
  });

  it('leaves an existing demo row unchanged, or writes the seed data again with SEED_OVERWRITE=1', () => {
    const data = { title: { ru: 'Худи' }, order: 2 };
    deepStrictEqual(new SeedUpdates(optionsWith(undefined)).of(data), {});
    deepStrictEqual(new SeedUpdates(optionsWith('1')).of(data), data);
  });
});
