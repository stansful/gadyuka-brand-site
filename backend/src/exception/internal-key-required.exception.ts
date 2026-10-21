import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';

import { DomainErrorKind } from './domain-error-kind.enum';
import { DomainException } from './domain.exception';

/** The request did not carry the right x-internal-key (only the Next.js server may call the API). */
export class InternalKeyRequiredException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.UNAUTHORIZED,
      code: ApiErrorCode.INTERNAL_KEY_REQUIRED,
      messageKey: AdminMessageKey.ERRORS_NETWORK,
    });
  }
}
