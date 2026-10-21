import { Injectable } from '@nestjs/common';

import { ListPosition } from '~core/entities/list-position';
import { DatabaseService } from '~database';
import { CollectionWrite } from '~usecases/admin/catalog/common/collections/collection-write.factory';

@Injectable()
export class CollectionCreateRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Creates the collection last in the list; returns its id. */
  async create(collection: CollectionWrite): Promise<string> {
    const { client } = this.database;
    const last = await client.collection.aggregate({ _max: { order: true } });
    const row = await client.collection.create({
      data: { ...collection, order: ListPosition.after(last._max.order) },
      select: { id: true },
    });
    return row.id;
  }
}
