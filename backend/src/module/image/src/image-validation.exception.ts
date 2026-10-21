import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { ACCEPTED_FORMATS_LABEL } from '~core/media/accepted-image-mime.enum';
import { MAX_UPLOAD_MEGABYTES } from '~core/media/media.constants';
import { DomainErrorKind, DomainExceptionOptions } from '~exception';
import { DomainException } from '~exception/domain.exception';

import { ImageValidationCode } from './image-validation-code.enum';

/** An uploaded image was refused: empty, too large, not an accepted format, or unreadable. */
export class ImageValidationException extends DomainException {
  private static readonly ERRORS: Readonly<Record<ImageValidationCode, Omit<DomainExceptionOptions, 'cause'>>> = {
    [ImageValidationCode.EMPTY]: {
      kind: DomainErrorKind.BAD_REQUEST,
      code: ApiErrorCode.BAD_REQUEST,
      messageKey: AdminMessageKey.MEDIA_ERRORS_EMPTY,
    },
    [ImageValidationCode.TOO_LARGE]: {
      kind: DomainErrorKind.PAYLOAD_TOO_LARGE,
      code: ApiErrorCode.PAYLOAD_TOO_LARGE,
      messageKey: AdminMessageKey.MEDIA_ERRORS_TOO_LARGE,
      values: { size: MAX_UPLOAD_MEGABYTES },
    },
    [ImageValidationCode.UNSUPPORTED]: {
      kind: DomainErrorKind.UNSUPPORTED_MEDIA_TYPE,
      code: ApiErrorCode.UNSUPPORTED_MEDIA_TYPE,
      messageKey: AdminMessageKey.MEDIA_ERRORS_UNSUPPORTED,
      values: { formats: ACCEPTED_FORMATS_LABEL },
    },
    [ImageValidationCode.PROCESSING_FAILED]: {
      kind: DomainErrorKind.BAD_REQUEST,
      code: ApiErrorCode.BAD_REQUEST,
      messageKey: AdminMessageKey.MEDIA_ERRORS_PROCESSING_FAILED,
    },
  };

  constructor(
    readonly reason: ImageValidationCode,
    cause?: unknown,
  ) {
    super({ ...ImageValidationException.ERRORS[reason], cause });
  }
}
