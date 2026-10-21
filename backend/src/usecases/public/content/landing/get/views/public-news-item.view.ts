import { ApiProperty } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';
import type { PublicNewsItem } from '~shared/contracts/content';

import { PublicImageView } from '~usecases/public/content/common/views/public-image.view';

/** Swagger schema of a published news item (shared/contracts/content.ts). */
export class PublicNewsItemView implements PublicNewsItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  excerpt: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ description: 'ISO 8601', example: '2026-10-21T12:00:00.000Z' })
  date: string;

  @ApiProperty({ type: () => PublicImageView, nullable: true })
  image: ImageRef | null;
}
