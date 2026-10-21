import { Injectable, Logger } from '@nestjs/common';

import { MediaMessageKey } from '~core/constants/media-message-key.enum';
import { MediaNotFoundException } from '~usecases/admin/media/common/media-not-found.exception';
import { MediaObjectCleaner } from '~usecases/admin/media/common/media-object.cleaner';
import { Usecase } from '~usecases/usecase.interfaces';

import { DeletableMedia, MediaDeleteRepository } from './media-delete.repository';
import { MediaInUseException } from './media-in-use.exception';

export interface MediaDeleteCommand {
  readonly id: string;
}

/**
 * Deletes a media file — only when nothing references it (port of deleteMedia). The row goes
 * first, then the stored file: a failed file delete leaves an unreferenced object in the bucket
 * (logged), never a row pointing at a missing file.
 */
@Injectable()
export class MediaDeleteUsecase implements Usecase<MediaDeleteCommand, void> {
  private readonly logger = new Logger(MediaDeleteUsecase.name);

  constructor(
    private readonly repository: MediaDeleteRepository,
    private readonly cleaner: MediaObjectCleaner,
  ) {}

  async execute({ id }: MediaDeleteCommand): Promise<void> {
    const media = await this.findUnusedOrThrow(id);
    await this.repository.delete(media.id);
    const file = await this.cleaner.remove(media);
    this.logger.log('MediaDeleteUsecase : deleted', { media_id: media.id, file });
  }

  private async findUnusedOrThrow(id: string): Promise<DeletableMedia> {
    const media = await this.repository.findDeletable(id);
    if (media === null) {
      throw new MediaNotFoundException(MediaMessageKey.NOT_FOUND_DELETED);
    }
    if (media.usageCount > 0) {
      throw new MediaInUseException(media.usageCount);
    }
    return media;
  }
}
