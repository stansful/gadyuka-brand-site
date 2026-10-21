import { Injectable } from '@nestjs/common';

import { MEDIA_PAGE_SIZE } from '~core/media/media-library.constants';
import { MediaItemResponse } from '~usecases/admin/media/common/media-item.response';
import { MediaRecord } from '~usecases/admin/media/common/media-record';
import { Usecase } from '~usecases/usecase.interfaces';

import { MediaListRepository } from './media-list.repository';
import { MediaListResponse } from './media-list.response';

export interface MediaListQuery {
  /** Id of the last file of the previous page */
  readonly cursor: string | undefined;
  /** Already trimmed and cut; "" or undefined = no search */
  readonly search: string | undefined;
}

/**
 * A page of the media library (port of listMedia of the frontend's media-service.ts): newest
 * first, MEDIA_PAGE_SIZE per page, `nextCursor` = the last id of the page when more follow; plus
 * the number of all files.
 */
@Injectable()
export class MediaListUsecase implements Usecase<MediaListQuery, MediaListResponse> {
  constructor(private readonly repository: MediaListRepository) {}

  async execute({ cursor, search }: MediaListQuery): Promise<MediaListResponse> {
    const [rows, total] = await Promise.all([
      this.repository.findPage({ cursor, search, take: MEDIA_PAGE_SIZE + 1 }),
      this.repository.countAll(),
    ]);
    const items = rows.slice(0, MEDIA_PAGE_SIZE);
    return MediaListResponse.of({
      items: items.map(MediaItemResponse.fromRecord),
      nextCursor: this.nextCursorOf(rows, items),
      total,
    });
  }

  /** One row more than a page was asked for: there is a next page, starting after the last item. */
  private nextCursorOf(rows: readonly MediaRecord[], items: readonly MediaRecord[]): string | null {
    return rows.length > items.length ? (items[items.length - 1]?.id ?? null) : null;
  }
}
