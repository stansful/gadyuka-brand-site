import { Injectable } from '@nestjs/common';

import { GalleryRepository } from '~usecases/admin/content/common/gallery/gallery.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { GalleryListResponse } from './gallery-list.response';

/** The admin's gallery (manual order). */
@Injectable()
export class GalleryListUsecase implements Usecase<void, GalleryListResponse> {
  constructor(private readonly repository: GalleryRepository) {}

  async execute(): Promise<GalleryListResponse> {
    return GalleryListResponse.of(await this.repository.findList());
  }
}
