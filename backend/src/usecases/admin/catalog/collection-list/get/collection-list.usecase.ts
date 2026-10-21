import { Injectable } from '@nestjs/common';

import { Usecase } from '~usecases/usecase.interfaces';

import { CollectionListRepository } from './collection-list.repository';
import { CollectionListResponse } from './collection-list.response';

/** The collections of the admin list (drag & drop order, publish toggle, delete warning). */
@Injectable()
export class CollectionListUsecase implements Usecase<void, CollectionListResponse> {
  constructor(private readonly repository: CollectionListRepository) {}

  async execute(): Promise<CollectionListResponse> {
    return CollectionListResponse.of(await this.repository.findAll());
  }
}
