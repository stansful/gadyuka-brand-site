import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

/** Which media rows exist (the picker of a form may hold a file deleted meanwhile). */
@Injectable()
export class PickedMediaRepository {
  constructor(private readonly database: DatabaseService) {}

  async countExisting(ids: readonly string[]): Promise<number> {
    return this.database.client.media.count({ where: { id: { in: [...ids] } } });
  }
}
