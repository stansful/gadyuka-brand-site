import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The key is no site text (any more): removed from shared/messages by a newer release, or a stale page. */
export class SiteTextNotFoundException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.NOT_FOUND,
      code: ApiErrorCode.NOT_FOUND,
      messageKey: SiteTextsMessageKey.ERRORS_UNKNOWN_KEY,
    });
  }
}
