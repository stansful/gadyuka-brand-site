/** The demo entities need every seed image, but some were not created in this run. */
export class SeedMediaMissingError extends Error {
  constructor(keys: readonly string[]) {
    super(`Seed media not created: ${keys.join(', ')}`);
    this.name = 'SeedMediaMissingError';
  }
}
