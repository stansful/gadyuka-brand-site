import { ApiProperty } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';

/** Swagger schema of a picture of the public site (shared/contracts/common.ts ImageRef). */
export class PublicImageView implements ImageRef {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Public URL (Media.url)', example: '/media/admin/<ownerId>/<uuid>/image.webp' })
  src: string;

  @ApiProperty({ example: 1600 })
  width: number;

  @ApiProperty({ example: 1200 })
  height: number;

  @ApiProperty({ example: 'image/webp' })
  mime: string;

  @ApiProperty({ description: 'Alt text in the requested locale ("" when missing: no fallback)' })
  alt: string;

  @ApiProperty({ description: 'Alt text in the default locale (ru)' })
  altDefault: string;
}
