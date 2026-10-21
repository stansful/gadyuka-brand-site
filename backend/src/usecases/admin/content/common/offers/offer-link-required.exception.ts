import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { ContentEntitiesMessageKey } from '~core/constants/content-entities-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The offer has a button label but no button link (the admin shows it on the link field). */
export class OfferLinkRequiredException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.BAD_REQUEST,
      code: ApiErrorCode.BAD_REQUEST,
      messageKey: ContentEntitiesMessageKey.OFFERS_CTA_HREF_REQUIRED,
    });
  }
}
