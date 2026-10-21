import { ApiProperty } from '@nestjs/swagger';

import type { MediaListResponse as MediaListResponseContract } from '~shared/contracts/media';

import { MediaItemResponse } from '~usecases/admin/media/common/media-item.response';

/** A page of the media library, newest first. */
export class MediaListResponse implements MediaListResponseContract {
  @ApiProperty({ type: [MediaItemResponse] })
  items: MediaItemResponse[];

  @ApiProperty({ type: String, nullable: true, description: 'Cursor of the next page; null = the last page' })
  nextCursor: string | null;

  @ApiProperty({ example: 120, description: 'Number of all files of the library (not only the matching ones)' })
  total: number;

  static of(fields: Pick<MediaListResponse, 'items' | 'nextCursor' | 'total'>): MediaListResponse {
    return Object.assign(new MediaListResponse(), fields);
  }
}
