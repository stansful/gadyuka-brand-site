import { ApiProperty } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';
import type { PublicProduct } from '~shared/contracts/content';

import { PublicImageView } from './public-image.view';

/** Swagger schema of a published product (shared/contracts/content.ts). */
export class PublicProductView implements PublicProduct {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'noir-coat' })
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [String], description: 'Product.details split into trimmed, non-empty lines' })
  details: string[];

  @ApiProperty({ type: Number, nullable: true, description: 'Whole rubles; null = price on request' })
  price: number | null;

  @ApiProperty({ type: () => [PublicImageView] })
  images: ImageRef[];
}
