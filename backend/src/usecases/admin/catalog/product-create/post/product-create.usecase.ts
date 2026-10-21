import { Injectable, Logger } from '@nestjs/common';

import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { ProductSaveRules } from '~usecases/admin/catalog/common/products/product-save.rules';
import { ProductSaveCommand, ProductWriteFactory } from '~usecases/admin/catalog/common/products/product-write.factory';
import { Usecase } from '~usecases/usecase.interfaces';

import { ProductCreateRepository } from './product-create.repository';

/** Creates a product (last in its collection) with its photos in the given order. */
@Injectable()
export class ProductCreateUsecase implements Usecase<ProductSaveCommand, CatalogRowSavedResponse> {
  private readonly logger = new Logger(ProductCreateUsecase.name);

  constructor(
    private readonly rules: ProductSaveRules,
    private readonly repository: ProductCreateRepository,
  ) {}

  async execute(command: ProductSaveCommand): Promise<CatalogRowSavedResponse> {
    const product = ProductWriteFactory.fromCommand(command);
    await this.rules.assertCreatable(product);
    const id = await this.repository.create(product);
    this.logger.log('ProductCreateUsecase : created', { product_id: id, images: product.imageIds.length });
    return CatalogRowSavedResponse.of(id);
  }
}
