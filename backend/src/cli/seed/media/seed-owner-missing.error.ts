/** The seed images need their owner, the ADMIN user (AdminUserSeed runs first). */
export class SeedOwnerMissingError extends Error {
  constructor() {
    super('No ADMIN user to own the seed images: AdminUserSeed must run before SeedMediaSeed');
    this.name = 'SeedOwnerMissingError';
  }
}
