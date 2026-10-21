import { OrderScope } from '~core/entities/entity-order';
import { DatabaseService } from '~database';

import { OrderableRows, PublishedChange } from '../entity-rows.interfaces';

/** Special offers. */
export class OfferRows implements OrderableRows {
  /** Every row is ordered in the one list. */
  private static readonly SCOPE = 'offer';

  constructor(private readonly database: DatabaseService) {}

  async updatePublished({ id, published }: PublishedChange): Promise<number> {
    const result = await this.database.client.offer.updateMany({ where: { id }, data: { published } });
    return result.count;
  }

  async delete(id: string): Promise<number> {
    const result = await this.database.client.offer.deleteMany({ where: { id } });
    return result.count;
  }

  async findOrderScopes(ids: readonly string[]): Promise<OrderScope[]> {
    const rows = await this.database.client.offer.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
    return rows.map(row => ({ id: row.id, scope: OfferRows.SCOPE }));
  }

  async updateOrder(ids: readonly string[]): Promise<void> {
    const { client } = this.database;
    await client.$transaction(
      ids.map((id, order) => client.offer.update({ where: { id }, data: { order }, select: { id: true } })),
    );
  }
}
