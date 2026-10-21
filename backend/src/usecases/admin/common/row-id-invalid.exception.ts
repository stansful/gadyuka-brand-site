import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The :id of an admin route is not a row id (a tampered or stale link): «Некорректный идентификатор». */
export class RowIdInvalidException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.BAD_REQUEST,
      code: ApiErrorCode.BAD_REQUEST,
      messageKey: AdminMessageKey.ERRORS_INVALID_ID,
    });
  }
}
