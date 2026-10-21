import { Injectable, Logger } from '@nestjs/common';

import type { AdminGalleryItemInput } from '~shared/contracts/content-entities';

import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { GalleryFieldsFactory } from '~usecases/admin/content/common/gallery/gallery-fields.factory';
import { GalleryRepository } from '~usecases/admin/content/common/gallery/gallery.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface GalleryUpdateCommand extends AdminGalleryItemInput {
  readonly id: string;
}

/** Saves the edit form of a gallery item (its place in the gallery stays). */
@Injectable()
export class GalleryUpdateUsecase implements Usecase<GalleryUpdateCommand, ContentEntitySavedResponse> {
  private readonly logger = new Logger(GalleryUpdateUsecase.name);

  constructor(
    private readonly repository: GalleryRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute(command: GalleryUpdateCommand): Promise<ContentEntitySavedResponse> {
    await this.media.assertExist([command.mediaId]);
    await this.repository.update(command.id, GalleryFieldsFactory.fromInput(command));
    this.logger.log('GalleryUpdateUsecase : gallery item saved', { gallery_item_id: command.id });
    return ContentEntitySavedResponse.of(command.id);
  }
}
