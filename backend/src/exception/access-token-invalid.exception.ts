import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';

import { DomainErrorKind } from './domain-error-kind.enum';
import { DomainException } from './domain.exception';

/** The access token is malformed, badly signed, expired, or its session is over. */
export class AccessTokenInvalidException extends DomainException {
  constructor(cause?: unknown) {
    super({
      kind: DomainErrorKind.UNAUTHORIZED,
      code: ApiErrorCode.ACCESS_TOKEN_INVALID,
      messageKey: AdminMessageKey.ERRORS_SESSION_EXPIRED,
      cause,
    });
  }
}
