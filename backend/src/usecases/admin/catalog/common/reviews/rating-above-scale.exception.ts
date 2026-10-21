import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { CatalogMessageKey } from '~core/constants/catalog-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/**
 * The rating exceeds the current star scale («Оценка {rating} больше шкалы»; the form shows
 * «Оценка от 1 до {max}» at the rating field — both values travel with the error).
 */
export class RatingAboveScaleException extends DomainException {
  constructor(rating: number, max: number) {
    super({
      kind: DomainErrorKind.BAD_REQUEST,
      code: ApiErrorCode.BAD_REQUEST,
      messageKey: CatalogMessageKey.REVIEWS_RATING_ABOVE_SCALE,
      values: { rating, max },
    });
  }
}
