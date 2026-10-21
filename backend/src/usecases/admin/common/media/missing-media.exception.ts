import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { DomainErrorKind, DomainException } from '~exception';

/**
 * A picked media file no longer exists (deleted in another tab: a stale picker) — reported before the
 * write instead of a foreign key error: «Выбранное изображение не найдено…».
 */
export class MissingMediaException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.BAD_REQUEST,
      code: ApiErrorCode.BAD_REQUEST,
      messageKey: AdminMessageKey.ERRORS_MISSING_MEDIA,
    });
  }
}
