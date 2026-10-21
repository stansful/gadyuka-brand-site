import type { AdminSiteSettingsSaveRequest } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { CATALOG_TEXT_LIMITS } from '~core/catalog/catalog.constants';
import { CatalogField } from '~usecases/admin/catalog/common/fields/catalog.field';
import { IdField } from '~usecases/admin/catalog/common/fields/id.field';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';

/** Body of PUT /admin/settings. */
export class SettingsUpdateDto implements AdminSiteSettingsSaveRequest {
  @CatalogField.phone()
  phone: string;

  @CatalogField.email()
  email: string;

  @LocalizedTextField.optional({ max: CATALOG_TEXT_LIMITS.ADDRESS })
  address: LocalizedText;

  @CatalogField.ratingScale()
  reviewRatingMax: number;

  @LocalizedTextField.optional({ max: CATALOG_TEXT_LIMITS.SEO_TITLE })
  seoTitle: LocalizedText;

  @LocalizedTextField.optional({ max: CATALOG_TEXT_LIMITS.SEO_DESCRIPTION })
  seoDescription: LocalizedText;

  @IdField.nullableMedia()
  ogImageId: string | null;
}
