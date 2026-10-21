/** What happened to the Media row of one seed image. */
export enum SeedMediaOutcome {
  /** Created (or refreshed) for the current content of the source */
  CREATED = 'CREATED',
  /** The row of the current content already existed */
  REUSED = 'REUSED',
  /** The source changed since an earlier seed: the older row is kept (no SEED_OVERWRITE) */
  KEPT = 'KEPT',
}
