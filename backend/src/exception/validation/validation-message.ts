import { ValidationOptions } from 'class-validator';

import type { MessageValues } from '~shared/contracts/errors';

/**
 * Validation messages are message KEYS of shared/messages (+ ICU values), never prose:
 *
 *   @MaxLength(64, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: 64 }))
 *
 * ValidationErrorMapper reads the key from the constraint message and the values from its context.
 */
export class ValidationMessage {
  private static readonly KEY_PATTERN = /^[A-Za-z][\w-]*(\.[\w-]+)+$/;

  static of(key: string, values?: MessageValues): ValidationOptions {
    return { message: key, context: { values } };
  }

  static isKey(text: string): boolean {
    return ValidationMessage.KEY_PATTERN.test(text);
  }
}
