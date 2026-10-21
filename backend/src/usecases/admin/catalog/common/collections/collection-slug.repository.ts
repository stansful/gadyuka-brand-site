import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

@Injectable()
export class CollectionSlugRepository {
  constructor(private readonly database: DatabaseService) {}

  /** The id of the collection with this slug (null = the slug is free). */
  async findSlugOwner(slug: string): Promise<string | null> {
    const row = await this.database.client.collection.findUnique({ where: { slug }, select: { id: true } });
    return row?.id ?? null;
  }
}
