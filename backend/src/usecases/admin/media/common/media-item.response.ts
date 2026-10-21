import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { MediaItem } from '~shared/contracts/media';

import { MediaRecord } from './media-record';

/** A file of the media library (list item, details, upload answer). */
export class MediaItemResponse implements MediaItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/media/admin/0199…/3f2b…/image.webp', description: 'Public link of the file' })
  url: string;

  @ApiProperty({ example: 1200 })
  width: number;

  @ApiProperty({ example: 800 })
  height: number;

  @ApiProperty({ example: { ru: 'Белое худи', en: 'White hoodie' }, description: 'Alt text per locale' })
  alt: LocalizedText;

  @ApiProperty({ example: 'image/webp' })
  mime: string;

  @ApiProperty({ example: 123456, description: 'Bytes' })
  size: number;

  @ApiProperty({ type: String, nullable: true, example: 'hoodie.jpg' })
  originalName: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ example: 2, description: 'Places that reference the file (0 = it can be deleted)' })
  usageCount: number;

  static fromRecord({ createdAt, ...record }: MediaRecord): MediaItemResponse {
    return Object.assign(new MediaItemResponse(), { ...record, createdAt: createdAt.toISOString() });
  }
}
