/** A text of the demo content is missing from shared/messages/content/<locale>.json. */
export class SeedCopyMissingError extends Error {
  constructor(path: string, locale: string) {
    super(`shared/messages/content/${locale}.json has no text at "${path}"`);
    this.name = 'SeedCopyMissingError';
  }
}
