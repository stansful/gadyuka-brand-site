import { Injectable } from '@nestjs/common';

import { EntityNotFoundException } from '~usecases/admin/entities/common/entity-not-found.exception';
import { Usecase } from '~usecases/usecase.interfaces';

import { CollectionDetailsRepository } from './collection-details.repository';
import { CollectionDetailsResponse } from './collection-details.response';

export interface CollectionDetailsQuery {
  readonly id: string;
}

/** One collection for its edit form (404 notFound when it does not exist). */
@Injectable()
export class CollectionDetailsUsecase implements Usecase<CollectionDetailsQuery, CollectionDetailsResponse> {
  constructor(private readonly repository: CollectionDetailsRepository) {}

  async execute({ id }: CollectionDetailsQuery): Promise<CollectionDetailsResponse> {
    const details = await this.repository.findById(id);
    if (details === null) {
      throw new EntityNotFoundException();
    }
    return CollectionDetailsResponse.of(details);
  }
}
