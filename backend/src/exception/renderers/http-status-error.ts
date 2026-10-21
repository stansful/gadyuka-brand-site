import { HttpStatus } from '@nestjs/common';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';

import { RenderedError } from './rendered-error';

/** The generic body of an HTTP status (errors that carry no message key of their own). */
export class HttpStatusError {
  private static readonly CODES: Readonly<Partial<Record<number, ApiErrorCode>>> = {
    [HttpStatus.UNAUTHORIZED]: ApiErrorCode.UNAUTHORIZED,
    [HttpStatus.FORBIDDEN]: ApiErrorCode.FORBIDDEN,
    [HttpStatus.NOT_FOUND]: ApiErrorCode.NOT_FOUND,
    [HttpStatus.METHOD_NOT_ALLOWED]: ApiErrorCode.NOT_FOUND,
    [HttpStatus.CONFLICT]: ApiErrorCode.CONFLICT,
    [HttpStatus.PAYLOAD_TOO_LARGE]: ApiErrorCode.PAYLOAD_TOO_LARGE,
    [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ApiErrorCode.UNSUPPORTED_MEDIA_TYPE,
    [HttpStatus.TOO_MANY_REQUESTS]: ApiErrorCode.THROTTLED,
    [HttpStatus.BAD_GATEWAY]: ApiErrorCode.STORAGE_UNAVAILABLE,
    [HttpStatus.SERVICE_UNAVAILABLE]: ApiErrorCode.UNAVAILABLE,
  };

  private static readonly KEYS: Readonly<Partial<Record<ApiErrorCode, AdminMessageKey>>> = {
    [ApiErrorCode.BAD_REQUEST]: AdminMessageKey.ERRORS_INVALID_REQUEST,
    [ApiErrorCode.UNAUTHORIZED]: AdminMessageKey.AUTH_SESSION_REQUIRED,
    [ApiErrorCode.FORBIDDEN]: AdminMessageKey.ERRORS_FORBIDDEN,
    [ApiErrorCode.NOT_FOUND]: AdminMessageKey.ERRORS_NOT_FOUND,
    [ApiErrorCode.PAYLOAD_TOO_LARGE]: AdminMessageKey.MEDIA_ERRORS_FILE_TOO_LARGE,
  };

  static of(status: number): RenderedError {
    const code = HttpStatusError.codeOf(status);
    const messageKey = HttpStatusError.KEYS[code] ?? AdminMessageKey.ERRORS_ACTION_FAILED;
    return { status, body: { statusCode: status, error: code, key: messageKey } };
  }

  private static codeOf(status: number): ApiErrorCode {
    const known = HttpStatusError.CODES[status];
    if (known !== undefined) {
      return known;
    }
    return status < HttpStatus.INTERNAL_SERVER_ERROR ? ApiErrorCode.BAD_REQUEST : ApiErrorCode.INTERNAL;
  }
}
