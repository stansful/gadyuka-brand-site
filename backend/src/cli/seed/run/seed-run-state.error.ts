/** A seed step read the run state before the step that sets it ran (an error in the order of SEED_STEPS). */
export class SeedRunStateError extends Error {
  constructor(what: string) {
    super(`The seed run has no ${what} yet: check the order of SEED_STEPS (src/cli/seed/seed.steps.ts)`);
    this.name = 'SeedRunStateError';
  }
}
