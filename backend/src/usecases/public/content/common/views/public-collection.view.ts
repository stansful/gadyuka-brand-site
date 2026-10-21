import { ApiProperty } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';
import type { PublicCollection, PublicProduct } from '~shared/contracts/content';

import { PublicImageView } from './public-image.view';
import { PublicProductView } from './public-product.view';

/** Swagger schema of a published collection (shared/contracts/content.ts). */
export class PublicCollectionView implements PublicCollection {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'noir' })
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: () => PublicImageView, nullable: true })
  cover: ImageRef | null;

  @ApiProperty({ type: () => [PublicProductView], description: 'Published products, ordered (at most 48)' })
  products: PublicProduct[];
}
