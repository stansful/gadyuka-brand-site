import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { CatalogMessageKey } from '~core/constants/catalog-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** Another collection / product already has the slug («Адрес уже занят»; the form marks the slug field). */
export class SlugTakenException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.CONFLICT,
      code: ApiErrorCode.CONFLICT,
      messageKey: CatalogMessageKey.ERRORS_SLUG_TAKEN,
    });
  }
}
