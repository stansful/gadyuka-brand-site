import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { CatalogMessageKey } from '~core/constants/catalog-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/**
 * The star scale cannot drop below a stored rating: `count` reviews are rated above `max` (the
 * form links to exactly those: /admin/reviews?ratingAbove=<max>).
 */
export class RatingScaleTooLowException extends DomainException {
  constructor(count: number, max: number) {
    super({
      kind: DomainErrorKind.CONFLICT,
      code: ApiErrorCode.CONFLICT,
      messageKey: CatalogMessageKey.SETTINGS_SCALE_TOO_LOW,
      values: { count, max },
    });
  }
}
