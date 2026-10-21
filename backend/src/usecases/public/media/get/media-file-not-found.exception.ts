import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** /media/<path> that is not a servable key (traversal, odd characters, not an image …). */
export class MediaFileNotFoundException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.NOT_FOUND,
      code: ApiErrorCode.NOT_FOUND,
      messageKey: AdminMessageKey.MEDIA_ERRORS_NOT_FOUND,
    });
  }
}
