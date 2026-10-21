/** class-transformer step of the DTOs: strings are trimmed before validation, anything else is left for the validators. */
export class TrimmedText {
  static of(value: unknown): unknown {
    return typeof value === 'string' ? value.trim() : value;
  }
}
