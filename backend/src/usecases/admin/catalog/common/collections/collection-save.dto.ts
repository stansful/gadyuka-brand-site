import type { AdminCollectionSaveRequest } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { CATALOG_TEXT_LIMITS } from '~core/catalog/catalog.constants';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';

import { CatalogField } from '../fields/catalog.field';
import { IdField } from '../fields/id.field';

/** Body of POST /admin/collections and PUT /admin/collections/:id. */
export class CollectionSaveDto implements AdminCollectionSaveRequest {
  @CatalogField.slug()
  slug: string;

  @LocalizedTextField.required({ max: CATALOG_TEXT_LIMITS.TITLE })
  title: LocalizedText;

  @LocalizedTextField.optional({ max: CATALOG_TEXT_LIMITS.DESCRIPTION })
  description: LocalizedText;

  @IdField.nullableMedia()
  coverId: string | null;

  @CatalogField.published()
  published: boolean;
}
