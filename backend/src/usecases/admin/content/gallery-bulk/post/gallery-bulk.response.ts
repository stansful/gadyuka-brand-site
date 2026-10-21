import { ApiProperty } from '@nestjs/swagger';

import type { AdminGalleryBulkAdded } from '~shared/contracts/content-entities';

/** Answer of POST /admin/gallery/bulk: how many photos were added. */
export class GalleryBulkResponse implements AdminGalleryBulkAdded {
  @ApiProperty()
  count: number;

  static of(count: number): GalleryBulkResponse {
    return Object.assign(new GalleryBulkResponse(), { count });
  }
}
