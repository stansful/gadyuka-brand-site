import { Injectable } from '@nestjs/common';

import { ListPosition } from '~core/entities/list-position';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { ProductImageRows } from '~usecases/admin/catalog/common/products/product-image.rows';
import { ProductOrderRows } from '~usecases/admin/catalog/common/products/product-order.rows';
import { ProductWrite } from '~usecases/admin/catalog/common/products/product-write.factory';

interface ProductMove {
  readonly from: string;
  readonly to: string;
}

@Injectable()
export class ProductUpdateRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Overwrites the product and its photos in one transaction (moved to another collection → last
   * there). Returns false when the product does not exist.
   */
  async update(id: string, { fields, imageIds }: ProductWrite): Promise<boolean> {
    return this.database.client.$transaction(async tx => {
      const current = await tx.product.findUnique({ where: { id }, select: { collectionId: true } });
      if (current === null) {
        return false;
      }
      const position = await this.positionOf(tx, { from: current.collectionId, to: fields.collectionId });
      await tx.product.update({ where: { id }, data: { ...fields, ...position }, select: { id: true } });
      await ProductImageRows.sync(tx, id, imageIds);
      return true;
    });
  }

  /** No change of `order` within the collection; the end of the new collection after a move. */
  private async positionOf(tx: Prisma.TransactionClient, move: ProductMove): Promise<{ order?: number }> {
    if (ListPosition.isKeptOnMove(move.from, move.to)) {
      return {};
    }
    return { order: await ProductOrderRows.next(tx, move.to) };
  }
}
