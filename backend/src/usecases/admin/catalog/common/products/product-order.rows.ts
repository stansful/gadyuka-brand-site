import { ListPosition } from '~core/entities/list-position';
import { Prisma } from '~prisma-generated/prisma/client';

/** Positions of products, which are ordered within their collection. */
export class ProductOrderRows {
  /** The order of a product added last to the collection. */
  static async next(tx: Prisma.TransactionClient, collectionId: string): Promise<number> {
    const last = await tx.product.aggregate({ where: { collectionId }, _max: { order: true } });
    return ListPosition.after(last._max.order);
  }
}
