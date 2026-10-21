import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminGalleryItemDetails } from '~shared/contracts/content-entities';

import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';
import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

import { GalleryRecord } from './gallery.records';

/** A gallery item (rows of GET /admin/gallery, GET /admin/gallery/:id). */
export class GalleryItemDetailsResponse implements AdminGalleryItemDetails {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: MediaRefResponse })
  media: MediaRefResponse;

  @ApiProperty(LocalizedTextSchema.of('Caption'))
  caption: LocalizedText;

  @ApiProperty()
  published: boolean;

  static of({ id, media, caption, published }: GalleryRecord): GalleryItemDetailsResponse {
    return Object.assign(new GalleryItemDetailsResponse(), { id, media, caption, published });
  }
}
