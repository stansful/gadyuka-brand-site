import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { CatalogMessageKey } from '~core/constants/catalog-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The edited product was deleted meanwhile («Товар не найден — возможно, его уже удалили»). */
export class ProductNotFoundException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.NOT_FOUND,
      code: ApiErrorCode.NOT_FOUND,
      messageKey: CatalogMessageKey.PRODUCTS_NOT_FOUND,
    });
  }
}
