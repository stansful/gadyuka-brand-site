import { Injectable, Logger } from '@nestjs/common';

import type { AdminGalleryItemInput } from '~shared/contracts/content-entities';

import { ListPosition } from '~core/entities/list-position';
import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { GalleryFieldsFactory } from '~usecases/admin/content/common/gallery/gallery-fields.factory';
import { GalleryRepository } from '~usecases/admin/content/common/gallery/gallery.repository';
import { Usecase } from '~usecases/usecase.interfaces';

/** Adds one photo to the end of the gallery. */
@Injectable()
export class GalleryCreateUsecase implements Usecase<AdminGalleryItemInput, ContentEntitySavedResponse> {
  private readonly logger = new Logger(GalleryCreateUsecase.name);

  constructor(
    private readonly repository: GalleryRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute(input: AdminGalleryItemInput): Promise<ContentEntitySavedResponse> {
    await this.media.assertExist([input.mediaId]);
    const order = ListPosition.after(await this.repository.findMaxOrder());
    const id = await this.repository.create(GalleryFieldsFactory.fromInput(input), order);
    this.logger.log('GalleryCreateUsecase : gallery item created', { gallery_item_id: id });
    return ContentEntitySavedResponse.of(id);
  }
}
