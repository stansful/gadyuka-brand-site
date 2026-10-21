import { Injectable, Logger } from '@nestjs/common';

import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { ProductNotFoundException } from '~usecases/admin/catalog/common/products/product-not-found.exception';
import { ProductSaveRules } from '~usecases/admin/catalog/common/products/product-save.rules';
import { ProductSaveCommand, ProductWriteFactory } from '~usecases/admin/catalog/common/products/product-write.factory';
import { Usecase } from '~usecases/usecase.interfaces';

import { ProductUpdateRepository } from './product-update.repository';

export interface ProductUpdateCommand extends ProductSaveCommand {
  readonly id: string;
}

/** Saves the edit form of a product: fields, collection (moved → last there) and photos in order. */
@Injectable()
export class ProductUpdateUsecase implements Usecase<ProductUpdateCommand, CatalogRowSavedResponse> {
  private readonly logger = new Logger(ProductUpdateUsecase.name);

  constructor(
    private readonly rules: ProductSaveRules,
    private readonly repository: ProductUpdateRepository,
  ) {}

  async execute({ id, ...fields }: ProductUpdateCommand): Promise<CatalogRowSavedResponse> {
    const product = ProductWriteFactory.fromCommand(fields);
    await this.rules.assertUpdatable(id, product);
    if (!(await this.repository.update(id, product))) {
      throw new ProductNotFoundException();
    }
    this.logger.log('ProductUpdateUsecase : saved', { product_id: id, images: product.imageIds.length });
    return CatalogRowSavedResponse.of(id);
  }
}
