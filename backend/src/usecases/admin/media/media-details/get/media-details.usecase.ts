import { Injectable } from '@nestjs/common';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { MediaItemResponse } from '~usecases/admin/media/common/media-item.response';
import { MediaNotFoundException } from '~usecases/admin/media/common/media-not-found.exception';
import { Usecase } from '~usecases/usecase.interfaces';

import { MediaDetailsRepository } from './media-details.repository';
import { MediaDetailsResponse } from './media-details.response';
import { MediaUsageCollector } from './media-usage.collector';

export interface MediaDetailsQuery {
  readonly id: string;
}

/** A media file and every place that uses it, with links to the admin pages (the details dialog). */
@Injectable()
export class MediaDetailsUsecase implements Usecase<MediaDetailsQuery, MediaDetailsResponse> {
  constructor(
    private readonly repository: MediaDetailsRepository,
    private readonly usages: MediaUsageCollector,
  ) {}

  async execute({ id }: MediaDetailsQuery): Promise<MediaDetailsResponse> {
    const [media, usageRows] = await Promise.all([this.repository.findMedia(id), this.repository.findUsageRows(id)]);
    if (media === null || usageRows === null) {
      throw new MediaNotFoundException(AdminMessageKey.MEDIA_ERRORS_NOT_FOUND);
    }
    return MediaDetailsResponse.of({
      media: MediaItemResponse.fromRecord(media),
      usages: this.usages.collect(usageRows),
    });
  }
}
