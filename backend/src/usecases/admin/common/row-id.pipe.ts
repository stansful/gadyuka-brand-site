import { Injectable, PipeTransform } from '@nestjs/common';

import { isUUID } from 'class-validator';

import { RowIdInvalidException } from './row-id-invalid.exception';

/**
 * The :id path parameter of an admin entity route (catalog, content entities): a row id (UUID), else
 * 400 badRequest admin.errors.invalidId — one form-level message, as the admin showed for a malformed id.
 */
@Injectable()
export class RowIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !isUUID(value)) {
      throw new RowIdInvalidException();
    }
    return value;
  }
}
