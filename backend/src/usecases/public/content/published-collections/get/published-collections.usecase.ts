import { Injectable } from '@nestjs/common';

import { PublishedCollectionsRepository } from '~usecases/public/content/common/published-collections.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { PublishedCollectionsResponse } from './published-collections.response';

/** Slugs of the published collections (port of the frontend's getPublishedCollectionSlugs). */
@Injectable()
export class PublishedCollectionsUsecase implements Usecase<void, PublishedCollectionsResponse> {
  constructor(private readonly collections: PublishedCollectionsRepository) {}

  async execute(): Promise<PublishedCollectionsResponse> {
    return PublishedCollectionsResponse.of(await this.collections.findSlugs());
  }
}
