import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** An already exchanged refresh token was presented again: the session was revoked (stolen token). */
export class RefreshTokenReusedException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.UNAUTHORIZED,
      code: ApiErrorCode.REFRESH_TOKEN_REUSED,
      messageKey: AdminMessageKey.ERRORS_SESSION_EXPIRED,
    });
  }
}
