import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { CollectionWrite } from '~usecases/admin/catalog/common/collections/collection-write.factory';

@Injectable()
export class CollectionUpdateRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Overwrites the collection (its position stays); a missing row → 404 notFound (ApiExceptionFilter). */
  async update(id: string, collection: CollectionWrite): Promise<void> {
    await this.database.client.collection.update({ where: { id }, data: collection, select: { id: true } });
  }
}
