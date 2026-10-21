import { UnchangedRow } from '../run/seed-updates';

/**
 * One demo row to upsert: its unique key (id or slug), the seed data for a create and the update of an
 * existing row (nothing, or the seed data again with SEED_OVERWRITE=1 — SeedUpdates).
 */
export interface DemoRowUpsert<Key, Data> {
  readonly key: Key;
  readonly data: Data;
  readonly update: Data | UnchangedRow;
}
