import { Type } from '@nestjs/common';

import type { MessageRef } from '~shared/contracts/errors';

import { ValidationFailedException } from '~exception';

import { ApiValidationPipe } from '../../../../../pipe/api-validation.pipe';

/** The outcome of validating a request body like the app does (the global ApiValidationPipe). */
export type DtoValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fields: Readonly<Record<string, MessageRef>> };

/** Runs a body through the real validation pipe — unit tests of the DTO rules without HTTP. */
export class DtoValidation {
  private static readonly pipe = new ApiValidationPipe();

  static async validate<T>(dto: Type<T>, body: unknown): Promise<DtoValidationResult<T>> {
    try {
      const value: T = await DtoValidation.pipe.transform(body, { type: 'body', metatype: dto });
      return { ok: true, value };
    } catch (error: unknown) {
      if (error instanceof ValidationFailedException) {
        return { ok: false, fields: error.fields };
      }
      throw error;
    }
  }

  /** The field errors of `body` ({} when it is valid). */
  static async fieldsOf<T>(dto: Type<T>, body: unknown): Promise<Readonly<Record<string, MessageRef>>> {
    const result = await DtoValidation.validate(dto, body);
    return result.ok ? {} : result.fields;
  }
}
