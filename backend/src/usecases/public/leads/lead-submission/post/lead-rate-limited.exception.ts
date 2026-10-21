import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { LeadsMessageKey } from '~core/constants/leads-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The visitor's network sent its 5 leads of the last 10 minutes: 429, `details.retryAfterSeconds`. */
export class LeadRateLimitedException extends DomainException {
  constructor(retryAfterSeconds: number) {
    super({
      kind: DomainErrorKind.TOO_MANY_REQUESTS,
      code: ApiErrorCode.THROTTLED,
      messageKey: LeadsMessageKey.RATE_LIMITED,
      details: { retryAfterSeconds },
    });
  }
}
