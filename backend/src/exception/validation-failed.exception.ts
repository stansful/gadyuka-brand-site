import type { MessageRef } from '~shared/contracts/errors';

/** A request failed DTO validation; `fields` is keyed by the dotted path of the field. */
export class ValidationFailedException extends Error {
  constructor(readonly fields: Readonly<Record<string, MessageRef>>) {
    super(`Validation failed: ${Object.keys(fields).join(', ')}`);
    this.name = 'ValidationFailedException';
  }
}
