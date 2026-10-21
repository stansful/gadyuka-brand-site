import { ValidateBy, ValidationOptions } from 'class-validator';

/**
 * class-validator rules of the admin forms that the library does not have (each takes the message key
 * options: ValidationMessage.of(key, values)). A non-string value fails each of them.
 */
export class TextValidators {
  /** At most `max` characters once trimmed (a translation, a name). */
  static maxTrimmedLength(max: number, options: ValidationOptions): PropertyDecorator {
    return ValidateBy(
      {
        name: 'maxTrimmedLength',
        constraints: [max],
        validator: { validate: (value: unknown) => typeof value === 'string' && value.trim().length <= max },
      },
      options,
    );
  }

  /** Not empty once trimmed. */
  static isNotBlank(options: ValidationOptions): PropertyDecorator {
    return ValidateBy(
      {
        name: 'isNotBlank',
        validator: { validate: (value: unknown) => typeof value === 'string' && value.trim() !== '' },
      },
      options,
    );
  }
}
