import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { ProductImageRows } from '~usecases/admin/catalog/common/products/product-image.rows';
import { ProductOrderRows } from '~usecases/admin/catalog/common/products/product-order.rows';
import { ProductWrite } from '~usecases/admin/catalog/common/products/product-write.factory';

@Injectable()
export class ProductCreateRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Creates the product last in its collection, with its photos, in one transaction; returns its id. */
  async create({ fields, imageIds }: ProductWrite): Promise<string> {
    return this.database.client.$transaction(async tx => {
      const order = await ProductOrderRows.next(tx, fields.collectionId);
      const { id } = await tx.product.create({ data: { ...fields, order }, select: { id: true } });
      await ProductImageRows.sync(tx, id, imageIds);
      return id;
    });
  }
}
