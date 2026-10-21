import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText, MediaRef } from '~shared/contracts/common';

import { LocalizedTextSchema } from '../fields/localized-text.schema';

/** A picture as the admin edits it (thumbnails, pickers): shared/contracts/common.ts MediaRef. */
export class MediaRefResponse implements MediaRef {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/media/admin/<ownerId>/<uuid>/image.webp', description: 'Public URL (Media.url)' })
  url: string;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;

  @ApiProperty(LocalizedTextSchema.of('Alt text per locale'))
  alt: LocalizedText;

  static of({ id, url, width, height, alt }: MediaRef): MediaRefResponse {
    return Object.assign(new MediaRefResponse(), { id, url, width, height, alt });
  }

  static ofNullable(media: MediaRef | null): MediaRefResponse | null {
    return media === null ? null : MediaRefResponse.of(media);
  }
}
