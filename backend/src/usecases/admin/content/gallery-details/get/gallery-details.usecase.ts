import { Injectable } from '@nestjs/common';

import { ContentEntityNotFoundException } from '~usecases/admin/content/common/exceptions/content-entity-not-found.exception';
import { GalleryItemDetailsResponse } from '~usecases/admin/content/common/gallery/gallery-item-details.response';
import { GalleryRepository } from '~usecases/admin/content/common/gallery/gallery.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface GalleryDetailsQuery {
  readonly id: string;
}

/** One gallery item for the edit form. */
@Injectable()
export class GalleryDetailsUsecase implements Usecase<GalleryDetailsQuery, GalleryItemDetailsResponse> {
  constructor(private readonly repository: GalleryRepository) {}

  async execute({ id }: GalleryDetailsQuery): Promise<GalleryItemDetailsResponse> {
    const record = await this.repository.findById(id);
    if (record === undefined) {
      throw new ContentEntityNotFoundException();
    }
    return GalleryItemDetailsResponse.of(record);
  }
}
