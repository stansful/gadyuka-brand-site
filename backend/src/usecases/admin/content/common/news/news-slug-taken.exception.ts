import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { ContentEntitiesMessageKey } from '~core/constants/content-entities-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** Another news item already has the slug (the admin shows it on the slug field). */
export class NewsSlugTakenException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.CONFLICT,
      code: ApiErrorCode.CONFLICT,
      messageKey: ContentEntitiesMessageKey.ERRORS_SLUG_TAKEN,
    });
  }
}
