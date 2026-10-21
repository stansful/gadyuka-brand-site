import { Injectable } from '@nestjs/common';

import { SlugOwnership } from '~core/catalog/slug-ownership';
import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';

import { SlugTakenException } from '../slug-taken.exception';
import { CollectionSlugRepository } from './collection-slug.repository';
import { CollectionWrite } from './collection-write.factory';

/**
 * What a collection must satisfy before it is written (in this order, like the old action): a slug
 * no other collection has (409 slugTaken), an existing cover (400 missingMedia).
 */
@Injectable()
export class CollectionSaveRules {
  constructor(
    private readonly slugs: CollectionSlugRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async assertCreatable(collection: CollectionWrite): Promise<void> {
    this.assertSlugFree(new SlugOwnership(await this.slugs.findSlugOwner(collection.slug)));
    await this.media.assertExist([collection.coverId]);
  }

  async assertUpdatable(id: string, collection: CollectionWrite): Promise<void> {
    this.assertSlugFree(new SlugOwnership(await this.slugs.findSlugOwner(collection.slug), id));
    await this.media.assertExist([collection.coverId]);
  }

  private assertSlugFree(ownership: SlugOwnership): void {
    if (ownership.isTakenByAnother()) {
      throw new SlugTakenException();
    }
  }
}
