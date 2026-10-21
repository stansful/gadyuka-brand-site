import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorDetails, DomainErrorKind, DomainException } from '~exception';

/** A dependency (database, storage) does not answer: 503 with the state of each in `details`. */
export class DependenciesUnavailableException extends DomainException {
  constructor(details: DomainErrorDetails) {
    super({
      kind: DomainErrorKind.UNAVAILABLE,
      code: ApiErrorCode.UNAVAILABLE,
      messageKey: AdminMessageKey.ERRORS_ACTION_FAILED,
      details,
    });
  }
}
