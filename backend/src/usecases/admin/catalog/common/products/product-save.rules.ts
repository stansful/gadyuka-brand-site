import { Injectable } from '@nestjs/common';

import { SlugOwnership } from '~core/catalog/slug-ownership';
import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';

import { SlugTakenException } from '../slug-taken.exception';
import { ProductCollectionNotFoundException } from './product-collection-not-found.exception';
import { ProductRowsRepository } from './product-rows.repository';
import { ProductWrite } from './product-write.factory';

/**
 * What a product must satisfy before it is written (in this order, like the old action): a slug no
 * other product has (409 slugTaken), an existing collection (400 collectionNotFound), existing
 * photos (400 missingMedia).
 */
@Injectable()
export class ProductSaveRules {
  constructor(
    private readonly rows: ProductRowsRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async assertCreatable(product: ProductWrite): Promise<void> {
    this.assertSlugFree(new SlugOwnership(await this.rows.findSlugOwner(product.fields.slug)));
    await this.assertReferencesExist(product);
  }

  async assertUpdatable(id: string, product: ProductWrite): Promise<void> {
    this.assertSlugFree(new SlugOwnership(await this.rows.findSlugOwner(product.fields.slug), id));
    await this.assertReferencesExist(product);
  }

  private assertSlugFree(ownership: SlugOwnership): void {
    if (ownership.isTakenByAnother()) {
      throw new SlugTakenException();
    }
  }

  private async assertReferencesExist({ fields, imageIds }: ProductWrite): Promise<void> {
    if (!(await this.rows.hasCollection(fields.collectionId))) {
      throw new ProductCollectionNotFoundException();
    }
    await this.media.assertExist(imageIds);
  }
}
