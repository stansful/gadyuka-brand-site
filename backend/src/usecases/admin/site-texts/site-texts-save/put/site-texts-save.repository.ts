import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

/** The media library rows a save refers to. */
@Injectable()
export class SiteTextsSaveRepository {
  constructor(private readonly database: DatabaseService) {}

  /** The ids of `ids` that exist (≤ 20: one per landing image of the save). */
  async findMediaIds(ids: readonly string[]): Promise<string[]> {
    const rows = await this.database.client.media.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
    return rows.map(row => row.id);
  }
}
