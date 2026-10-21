/** A media key was about to be built from an unsafe owner id or uuid (a bug: they come from the database). */
export class InvalidMediaKeyError extends Error {
  constructor(part: string) {
    super(`Invalid media key part: ${part}`);
    this.name = 'InvalidMediaKeyError';
  }
}
