import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** Unknown, malformed, expired or revoked refresh token: sign in again. */
export class RefreshTokenInvalidException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.UNAUTHORIZED,
      code: ApiErrorCode.REFRESH_TOKEN_INVALID,
      messageKey: AdminMessageKey.ERRORS_SESSION_EXPIRED,
    });
  }
}
