import { ValidationError } from 'class-validator';

import type { MessageRef, MessageValues } from '~shared/contracts/errors';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';

import { ValidationMessage } from './validation-message';

type FieldErrors = Record<string, MessageRef>;

/**
 * class-validator errors → `fields` of the 400 validation body: { "<dotted path>": { key, values } }.
 * One message per field (the pipe stops at the first failed rule). Rules declared without a
 * message key (library defaults, unknown fields) get a generic admin.validation.* key.
 */
export class ValidationErrorMapper {
  private static readonly FALLBACK_KEYS: Readonly<Record<string, string>> = {
    whitelistValidation: AdminMessageKey.VALIDATION_UNKNOWN_FIELD,
    isNotEmpty: AdminMessageKey.VALIDATION_REQUIRED,
    isDefined: AdminMessageKey.VALIDATION_REQUIRED,
  };

  map(errors: readonly ValidationError[]): FieldErrors {
    const fields: FieldErrors = {};
    this.collect(errors, '', fields);
    return fields;
  }

  private collect(errors: readonly ValidationError[], parentPath: string, fields: FieldErrors): void {
    for (const error of errors) {
      const path = parentPath === '' ? error.property : `${parentPath}.${error.property}`;
      const message = this.firstMessage(error);
      if (message !== undefined) {
        fields[path] = message;
      }
      this.collect(error.children ?? [], path, fields);
    }
  }

  private firstMessage(error: ValidationError): MessageRef | undefined {
    const [constraint, text] = Object.entries(error.constraints ?? {})[0] ?? [];
    if (constraint === undefined || text === undefined) {
      return undefined;
    }
    return this.toMessage(constraint, text, error);
  }

  private toMessage(constraint: string, text: string, error: ValidationError): MessageRef {
    const values = this.valuesOf(constraint, error);
    const key = ValidationMessage.isKey(text) ? text : this.fallbackKey(constraint);
    return values === undefined ? { key } : { key, values };
  }

  private fallbackKey(constraint: string): string {
    return ValidationErrorMapper.FALLBACK_KEYS[constraint] ?? AdminMessageKey.VALIDATION_INVALID;
  }

  private valuesOf(constraint: string, error: ValidationError): MessageValues | undefined {
    const context: unknown = error.contexts?.[constraint];
    if (typeof context !== 'object' || context === null || !('values' in context)) {
      return undefined;
    }
    return (context as { values?: MessageValues }).values;
  }
}
