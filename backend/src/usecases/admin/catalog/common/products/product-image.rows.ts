import { Prisma } from '~prisma-generated/prisma/client';

/** The photos of a product (product_images), written inside the product's transaction. */
export class ProductImageRows {
  /** Keeps exactly `imageIds`, in that order (order = index): others removed, new ones added. */
  static async sync(tx: Prisma.TransactionClient, productId: string, imageIds: readonly string[]): Promise<void> {
    await tx.productImage.deleteMany({ where: { productId, mediaId: { notIn: [...imageIds] } } });
    for (const [order, mediaId] of imageIds.entries()) {
      await tx.productImage.upsert({
        where: { productId_mediaId: { productId, mediaId } },
        create: { productId, mediaId, order },
        update: { order },
        select: { id: true },
      });
    }
  }
}
