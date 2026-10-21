/**
 * One step of `npm run db:seed` (src/cli/seed/seed.steps.ts lists them in order). A step is
 * idempotent: running the seed again changes nothing that is already in place (and never overwrites
 * the admin's edits).
 */
export interface SeedStep {
  run(): Promise<void>;
}
