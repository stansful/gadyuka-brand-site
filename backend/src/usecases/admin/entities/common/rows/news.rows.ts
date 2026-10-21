import { DatabaseService } from '~database';

import { PublishableRows, PublishedChange } from '../entity-rows.interfaces';

/** News (no manual order: the site orders them by date). */
export class NewsRows implements PublishableRows {
  constructor(private readonly database: DatabaseService) {}

  async updatePublished({ id, published }: PublishedChange): Promise<number> {
    const result = await this.database.client.newsItem.updateMany({ where: { id }, data: { published } });
    return result.count;
  }

  async delete(id: string): Promise<number> {
    const result = await this.database.client.newsItem.deleteMany({ where: { id } });
    return result.count;
  }
}
