import { ValidateBy, ValidationOptions } from 'class-validator';

import { HttpUrl } from '~core/content-entities/http-url';

/**
 * class-validator rules of the content entities' links that the library does not have (each takes the
 * message key options: ValidationMessage.of(key, values)). A non-string value fails each of them. The
 * text rules of every admin form: ~usecases/admin/common/fields/text-validators.
 */
export class ContentValidators {
  /** An http(s) link (HttpUrl rules). */
  static isHttpUrl(options: ValidationOptions): PropertyDecorator {
    return ValidateBy(
      {
        name: 'isHttpUrl',
        validator: { validate: (value: unknown) => typeof value === 'string' && HttpUrl.isValid(value) },
      },
      options,
    );
  }

  /** At most `max` characters as stored (HttpUrl.normalize). */
  static maxHttpUrlLength(max: number, options: ValidationOptions): PropertyDecorator {
    return ValidateBy(
      {
        name: 'maxHttpUrlLength',
        constraints: [max],
        validator: {
          validate: (value: unknown) => typeof value === 'string' && HttpUrl.normalize(value).length <= max,
        },
      },
      options,
    );
  }
}
