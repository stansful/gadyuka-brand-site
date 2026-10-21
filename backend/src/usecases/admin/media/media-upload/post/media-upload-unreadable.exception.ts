import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { MediaMessageKey } from '~core/constants/media-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The multipart body of an upload could not be parsed (malformed, truncated, unexpected parts). */
export class MediaUploadUnreadableException extends DomainException {
  constructor(cause: unknown) {
    super({
      kind: DomainErrorKind.BAD_REQUEST,
      code: ApiErrorCode.BAD_REQUEST,
      messageKey: MediaMessageKey.UNREADABLE,
      cause,
    });
  }
}
