import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

/** Lookups of the product save rules. */
@Injectable()
export class ProductRowsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** The id of the product with this slug (null = the slug is free). */
  async findSlugOwner(slug: string): Promise<string | null> {
    const row = await this.database.client.product.findUnique({ where: { slug }, select: { id: true } });
    return row?.id ?? null;
  }

  async hasCollection(collectionId: string): Promise<boolean> {
    return (await this.database.client.collection.count({ where: { id: collectionId } })) > 0;
  }
}
