import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';

import { DomainErrorKind } from './domain-error-kind.enum';
import { DomainException } from './domain.exception';

/** Rate limit of a sensitive route (login) reached; `minutes` until the next attempt is allowed. */
export class TooManyAttemptsException extends DomainException {
  constructor(minutes: number) {
    super({
      kind: DomainErrorKind.TOO_MANY_REQUESTS,
      code: ApiErrorCode.THROTTLED,
      messageKey: AdminMessageKey.AUTH_THROTTLED,
      values: { minutes },
    });
  }
}
