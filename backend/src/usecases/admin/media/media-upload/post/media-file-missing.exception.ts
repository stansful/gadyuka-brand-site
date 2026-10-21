import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { MediaMessageKey } from '~core/constants/media-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The upload request has no file in the field `file`. */
export class MediaFileMissingException extends DomainException {
  constructor() {
    super({ kind: DomainErrorKind.BAD_REQUEST, code: ApiErrorCode.BAD_REQUEST, messageKey: MediaMessageKey.NO_FILE });
  }
}
