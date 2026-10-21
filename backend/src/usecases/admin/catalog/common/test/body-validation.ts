import { Type } from '@nestjs/common';

import type { MessageRef } from '~shared/contracts/errors';

import { ValidationFailedException } from '~exception';

import { ApiValidationPipe } from '../../../../../pipe/api-validation.pipe';

/** The global validation pipe of the app run on one DTO class (unit tests of the request bodies). */
export class BodyValidation<T extends object> {
  private readonly pipe = new ApiValidationPipe();

  constructor(private readonly metatype: Type<T>) {}

  /** The body as the controller receives it (transformed); throws when it is refused. */
  async accept(body: unknown): Promise<T> {
    return this.pipe.transform(body, { type: 'body', metatype: this.metatype });
  }

  /** The field errors of a refused body ({} when it is accepted). */
  async fieldsOf(body: unknown): Promise<Record<string, MessageRef>> {
    try {
      await this.accept(body);
      return {};
    } catch (error: unknown) {
      if (error instanceof ValidationFailedException) {
        return { ...error.fields };
      }
      throw error;
    }
  }
}
