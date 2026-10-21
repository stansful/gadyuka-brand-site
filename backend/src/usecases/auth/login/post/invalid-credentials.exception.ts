import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** Unknown login or wrong password (deliberately the same answer for both). */
export class InvalidCredentialsException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.UNAUTHORIZED,
      code: ApiErrorCode.INVALID_CREDENTIALS,
      messageKey: AdminMessageKey.AUTH_INVALID_CREDENTIALS,
    });
  }
}
