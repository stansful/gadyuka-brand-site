import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ApiErrorCode } from '~core/constants/api-error-code.enum';

import { DomainErrorKind } from './domain-error-kind.enum';
import { DomainException } from './domain.exception';

/** The signed-in user's role is not allowed on the route (@Roles). */
export class ForbiddenRoleException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.FORBIDDEN,
      code: ApiErrorCode.FORBIDDEN,
      messageKey: AdminMessageKey.ERRORS_FORBIDDEN,
    });
  }
}
