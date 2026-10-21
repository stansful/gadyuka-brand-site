import { ApiProperty } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';
import type { PublicGalleryItem } from '~shared/contracts/content';

import { PublicImageView } from '~usecases/public/content/common/views/public-image.view';

/** Swagger schema of a published gallery picture (shared/contracts/content.ts). */
export class PublicGalleryItemView implements PublicGalleryItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  caption: string;

  @ApiProperty({ type: () => PublicImageView })
  image: ImageRef;
}
