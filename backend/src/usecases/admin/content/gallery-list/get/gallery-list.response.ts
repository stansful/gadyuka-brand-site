import { ApiProperty } from '@nestjs/swagger';

import type { AdminGalleryListResponse } from '~shared/contracts/content-entities';

import { GalleryItemDetailsResponse } from '~usecases/admin/content/common/gallery/gallery-item-details.response';
import { GalleryRecord } from '~usecases/admin/content/common/gallery/gallery.records';

/** GET /admin/gallery: every gallery item in the manual order. */
export class GalleryListResponse implements AdminGalleryListResponse {
  @ApiProperty({ type: [GalleryItemDetailsResponse] })
  items: GalleryItemDetailsResponse[];

  static of(records: readonly GalleryRecord[]): GalleryListResponse {
    return Object.assign(new GalleryListResponse(), {
      items: records.map(record => GalleryItemDetailsResponse.of(record)),
    });
  }
}
