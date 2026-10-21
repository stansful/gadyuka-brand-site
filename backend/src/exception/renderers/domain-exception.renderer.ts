import { HttpStatus } from '@nestjs/common';

import type { ApiErrorResponse } from '~shared/contracts/errors';

import { DomainErrorKind } from '../domain-error-kind.enum';
import { DomainException } from '../domain.exception';
import { ExceptionRenderer, RenderedError } from './rendered-error';

export class DomainExceptionRenderer implements ExceptionRenderer {
  private static readonly STATUSES: Readonly<Record<DomainErrorKind, HttpStatus>> = {
    [DomainErrorKind.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
    [DomainErrorKind.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
    [DomainErrorKind.FORBIDDEN]: HttpStatus.FORBIDDEN,
    [DomainErrorKind.NOT_FOUND]: HttpStatus.NOT_FOUND,
    [DomainErrorKind.CONFLICT]: HttpStatus.CONFLICT,
    [DomainErrorKind.PAYLOAD_TOO_LARGE]: HttpStatus.PAYLOAD_TOO_LARGE,
    [DomainErrorKind.UNSUPPORTED_MEDIA_TYPE]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    [DomainErrorKind.TOO_MANY_REQUESTS]: HttpStatus.TOO_MANY_REQUESTS,
    [DomainErrorKind.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  };

  canRender(exception: unknown): boolean {
    return exception instanceof DomainException;
  }

  render(exception: DomainException): RenderedError {
    const status = DomainExceptionRenderer.STATUSES[exception.kind];
    return {
      status,
      body: { statusCode: status, error: exception.code, key: exception.messageKey, ...this.extrasOf(exception) },
    };
  }

  /** `values` and `details` only when the exception has them. */
  private extrasOf({ values, details }: DomainException): Pick<ApiErrorResponse, 'values' | 'details'> {
    return { ...(values && { values }), ...(details && { details }) };
  }
}
