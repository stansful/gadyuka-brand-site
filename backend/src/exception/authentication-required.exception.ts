import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';

import { DomainErrorKind } from './domain-error-kind.enum';
import { DomainException } from './domain.exception';

/** A protected route was called without `Authorization: Bearer <access token>`. */
export class AuthenticationRequiredException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.UNAUTHORIZED,
      code: ApiErrorCode.UNAUTHORIZED,
      messageKey: AdminMessageKey.AUTH_SESSION_REQUIRED,
    });
  }
}
