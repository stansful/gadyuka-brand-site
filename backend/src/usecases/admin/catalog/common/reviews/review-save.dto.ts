import type { AdminReviewSaveRequest } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { CATALOG_TEXT_LIMITS } from '~core/catalog/catalog.constants';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';

import { CatalogField } from '../fields/catalog.field';
import { IdField } from '../fields/id.field';

/** Body of POST /admin/reviews and PUT /admin/reviews/:id. */
export class ReviewSaveDto implements AdminReviewSaveRequest {
  @CatalogField.author()
  author: string;

  @LocalizedTextField.optional({ max: CATALOG_TEXT_LIMITS.REVIEW_ROLE })
  role: LocalizedText;

  @LocalizedTextField.required({ max: CATALOG_TEXT_LIMITS.REVIEW_TEXT })
  text: LocalizedText;

  @IdField.nullableMedia()
  avatarId: string | null;

  @CatalogField.rating()
  rating: number | null;

  @CatalogField.published()
  published: boolean;
}
