import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The row (or one of the rows of a reorder) does not exist — deleted meanwhile, or a stale page. */
export class EntityNotFoundException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.NOT_FOUND,
      code: ApiErrorCode.NOT_FOUND,
      messageKey: AdminMessageKey.ERRORS_NOT_FOUND,
    });
  }
}
