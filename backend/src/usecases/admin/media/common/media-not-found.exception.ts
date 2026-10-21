import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/**
 * The media file does not exist (deleted meanwhile, or a stale page). The key differs per place:
 * admin.media.errors.notFound (details) / admin.media.errors.notFoundDeleted (delete).
 */
export class MediaNotFoundException extends DomainException {
  constructor(messageKey: string) {
    super({ kind: DomainErrorKind.NOT_FOUND, code: ApiErrorCode.NOT_FOUND, messageKey });
  }
}
