import type { AdminGalleryItemInput } from '~shared/contracts/content-entities';

import { LocalizedTextValue } from '~core/locales/localized-text-value';

import { GalleryFields } from './gallery.records';

/** A validated gallery form → what is stored (the caption normalized). */
export class GalleryFieldsFactory {
  static fromInput(input: AdminGalleryItemInput): GalleryFields {
    return { mediaId: input.mediaId, caption: LocalizedTextValue.normalize(input.caption), published: input.published };
  }
}
