import type { AdminProductSaveRequest } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { CATALOG_TEXT_LIMITS } from '~core/catalog/catalog.constants';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';

import { CatalogField } from '../fields/catalog.field';
import { IdField } from '../fields/id.field';

/** Body of POST /admin/products and PUT /admin/products/:id. */
export class ProductSaveDto implements AdminProductSaveRequest {
  @CatalogField.slug()
  slug: string;

  @IdField.required()
  collectionId: string;

  @LocalizedTextField.required({ max: CATALOG_TEXT_LIMITS.TITLE })
  title: LocalizedText;

  @LocalizedTextField.optional({ max: CATALOG_TEXT_LIMITS.DESCRIPTION })
  description: LocalizedText;

  @LocalizedTextField.optional({ max: CATALOG_TEXT_LIMITS.DESCRIPTION })
  details: LocalizedText;

  @CatalogField.price()
  price: number | null;

  @IdField.productImages()
  imageIds: string[];

  @CatalogField.published()
  published: boolean;
}
