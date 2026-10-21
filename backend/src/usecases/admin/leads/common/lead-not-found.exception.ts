import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { LeadsMessageKey } from '~core/constants/leads-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** No lead with this id (deleted, or a stale link): 404 admin.leads.notFound. */
export class LeadNotFoundException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.NOT_FOUND,
      code: ApiErrorCode.NOT_FOUND,
      messageKey: LeadsMessageKey.ADMIN_NOT_FOUND,
    });
  }
}
