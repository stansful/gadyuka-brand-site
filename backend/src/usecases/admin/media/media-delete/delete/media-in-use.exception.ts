import type { MediaInUseDetails } from '~shared/contracts/media';

import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { MediaMessageKey } from '~core/constants/media-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The file is still referenced somewhere: replace or remove it there first (409, details.usageCount). */
export class MediaInUseException extends DomainException {
  constructor(usageCount: number) {
    const details: MediaInUseDetails = { usageCount };
    super({
      kind: DomainErrorKind.CONFLICT,
      code: ApiErrorCode.CONFLICT,
      messageKey: MediaMessageKey.IN_USE,
      details: { ...details },
    });
  }
}
