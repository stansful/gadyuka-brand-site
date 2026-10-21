import { OrderScope } from '~core/entities/entity-order';
import { DatabaseService } from '~database';

import { OrderableRows, PublishedChange } from '../entity-rows.interfaces';

/** Products, ordered within their collection. */
export class ProductRows implements OrderableRows {
  constructor(private readonly database: DatabaseService) {}

  async updatePublished({ id, published }: PublishedChange): Promise<number> {
    const result = await this.database.client.product.updateMany({ where: { id }, data: { published } });
    return result.count;
  }

  async delete(id: string): Promise<number> {
    const result = await this.database.client.product.deleteMany({ where: { id } });
    return result.count;
  }

  async findOrderScopes(ids: readonly string[]): Promise<OrderScope[]> {
    const rows = await this.database.client.product.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, collectionId: true },
    });
    return rows.map(row => ({ id: row.id, scope: row.collectionId }));
  }

  async updateOrder(ids: readonly string[]): Promise<void> {
    const { client } = this.database;
    await client.$transaction(
      ids.map((id, order) => client.product.update({ where: { id }, data: { order }, select: { id: true } })),
    );
  }
}
