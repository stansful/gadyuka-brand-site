import { Injectable, Logger } from '@nestjs/common';

import type { AdminGalleryBulkInput } from '~shared/contracts/content-entities';

import { ListPosition } from '~core/entities/list-position';
import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { GalleryRepository } from '~usecases/admin/content/common/gallery/gallery.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { GalleryBulkResponse } from './gallery-bulk.response';

/** Appends several photos to the gallery at once (captions can be filled in later). */
@Injectable()
export class GalleryBulkUsecase implements Usecase<AdminGalleryBulkInput, GalleryBulkResponse> {
  private readonly logger = new Logger(GalleryBulkUsecase.name);

  constructor(
    private readonly repository: GalleryRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute({ mediaIds, published }: AdminGalleryBulkInput): Promise<GalleryBulkResponse> {
    await this.media.assertExist(mediaIds);
    const firstOrder = ListPosition.after(await this.repository.findMaxOrder());
    const count = await this.repository.createMany({ mediaIds, published, firstOrder });
    this.logger.log('GalleryBulkUsecase : gallery items added', { count });
    return GalleryBulkResponse.of(count);
  }
}
