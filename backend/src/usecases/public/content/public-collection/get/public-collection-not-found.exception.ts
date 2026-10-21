import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** No published collection has this slug (never existed, deleted or hidden): the site shows its 404 page. */
export class PublicCollectionNotFoundException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.NOT_FOUND,
      code: ApiErrorCode.NOT_FOUND,
      messageKey: AdminMessageKey.ERRORS_NOT_FOUND,
    });
  }
}
