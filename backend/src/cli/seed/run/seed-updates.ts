import { Injectable } from '@nestjs/common';

import { SeedMode } from './seed-mode.enum';
import { SeedOptions } from './seed-options';

/** An upsert's `update` that changes nothing: the row stays as the admin left it. */
export type UnchangedRow = Record<string, never>;

/**
 * The `update` of a demo-row upsert: nothing (the row belongs to the admin once it exists) or, with
 * SEED_OVERWRITE=1, the seed data again (port of the frontend's `update: overwrite ? data : {}`).
 */
@Injectable()
export class SeedUpdates {
  private static readonly UPDATES: Readonly<Record<SeedMode, <T extends object>(data: T) => T | UnchangedRow>> = {
    [SeedMode.KEEP_EDITS]: () => ({}),
    [SeedMode.OVERWRITE]: data => data,
  };

  constructor(private readonly options: SeedOptions) {}

  of<T extends object>(data: T): T | UnchangedRow {
    return SeedUpdates.UPDATES[this.options.mode()](data);
  }
}
