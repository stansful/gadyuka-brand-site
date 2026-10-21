import { HttpStatus } from '@nestjs/common';

import { ValidationFailedException } from '../validation-failed.exception';
import { ExceptionRenderer, RenderedError } from './rendered-error';

export class ValidationFailedRenderer implements ExceptionRenderer {
  canRender(exception: unknown): boolean {
    return exception instanceof ValidationFailedException;
  }

  render(exception: ValidationFailedException): RenderedError {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: { statusCode: HttpStatus.BAD_REQUEST, error: 'validation', fields: exception.fields },
    };
  }
}
