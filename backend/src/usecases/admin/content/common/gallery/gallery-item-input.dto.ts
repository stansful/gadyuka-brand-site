import type { LocalizedText } from '~shared/contracts/common';
import type { AdminGalleryItemInput } from '~shared/contracts/content-entities';

import { GALLERY_LIMITS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';

import { ContentField } from '../validation/content-field';

/** Body of POST /admin/gallery and PUT /admin/gallery/:id (port of the admin's galleryInputSchema). */
export class GalleryItemInputDto implements AdminGalleryItemInput {
  @ContentField.mediaId('The photo (media id)')
  mediaId: string;

  @LocalizedTextField.optional({ max: GALLERY_LIMITS.CAPTION, description: 'Caption' })
  caption: LocalizedText;

  @ContentField.flag('Shown on the site')
  published: boolean;
}
