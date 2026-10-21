---
to: src/usecases/<%= base %>/<%= feature %>/<%= method %>/<%= feature %>.repository.ts
---
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

/** Data access of the usecase: explicit selects, parameterized queries, lists with a limit. */
@Injectable()
export class <%= h.changeCase.pascal(feature) %>Repository {
  constructor(private readonly database: DatabaseService) {}

  async countUsers(): Promise<number> {
    return this.database.client.user.count();
  }
}
