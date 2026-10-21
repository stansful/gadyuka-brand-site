import { HttpStatus } from '@nestjs/common';
import { StorageError, StorageFileNotFoundError, StorageInvalidKeyError } from '@nestjs/storage';

import { HttpStatusError } from './http-status-error';
import { ExceptionRenderer, RenderedError } from './rendered-error';

/** @nestjs/storage errors outside its HTTP helpers: a missing object is 404, anything else 502. */
export class StorageErrorRenderer implements ExceptionRenderer {
  canRender(exception: unknown): boolean {
    return exception instanceof StorageError;
  }

  render(exception: StorageError): RenderedError {
    const missing = exception instanceof StorageFileNotFoundError || exception instanceof StorageInvalidKeyError;
    return HttpStatusError.of(missing ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY);
  }
}
