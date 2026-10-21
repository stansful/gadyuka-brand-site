import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** A reorder mixes rows of different lists (products of different collections). */
export class InvalidEntityOrderException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.BAD_REQUEST,
      code: ApiErrorCode.BAD_REQUEST,
      messageKey: AdminMessageKey.ENTITIES_INVALID_ORDER,
    });
  }
}
