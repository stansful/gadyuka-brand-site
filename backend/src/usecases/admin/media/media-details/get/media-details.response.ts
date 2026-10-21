import { ApiProperty } from '@nestjs/swagger';

import type { MediaDetailsResponse as MediaDetailsResponseContract } from '~shared/contracts/media';

import { MediaItemResponse } from '~usecases/admin/media/common/media-item.response';

import { MediaUsageResponse } from './media-usage.response';

/** A media file with every place that uses it. */
export class MediaDetailsResponse implements MediaDetailsResponseContract {
  @ApiProperty({ type: MediaItemResponse })
  media: MediaItemResponse;

  @ApiProperty({ type: [MediaUsageResponse] })
  usages: MediaUsageResponse[];

  static of(fields: Pick<MediaDetailsResponse, 'media' | 'usages'>): MediaDetailsResponse {
    return Object.assign(new MediaDetailsResponse(), fields);
  }
}
