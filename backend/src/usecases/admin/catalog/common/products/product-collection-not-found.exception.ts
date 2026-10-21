import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { CatalogMessageKey } from '~core/constants/catalog-message-key.enum';
import { DomainErrorKind, DomainException } from '~exception';

/** The collection picked for a product does not exist (deleted meanwhile; the form marks the collection field). */
export class ProductCollectionNotFoundException extends DomainException {
  constructor() {
    super({
      kind: DomainErrorKind.BAD_REQUEST,
      code: ApiErrorCode.BAD_REQUEST,
      messageKey: CatalogMessageKey.PRODUCTS_COLLECTION_NOT_FOUND,
    });
  }
}
