/**
 * How a run treats rows that already exist (SEED_OVERWRITE):
 * - KEEP_EDITS (default): only missing rows are created; rows the admin may have edited are left alone
 *   (site messages still holding a seed value follow a changed default);
 * - OVERWRITE (`SEED_OVERWRITE=1`): every seeded row is reset to the seed copy — an explicit «reset to
 *   demo content».
 */
export enum SeedMode {
  KEEP_EDITS = 'KEEP_EDITS',
  OVERWRITE = 'OVERWRITE',
}
