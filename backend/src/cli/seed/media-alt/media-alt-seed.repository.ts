import { Injectable } from '@nestjs/common';

import type { LocalizedText } from '~shared/contracts/common';

import { DatabaseService } from '~database';

/** The stored alt text of a Media row (raw Json). */
export interface StoredMediaAlt {
  readonly id: string;
  readonly alt: unknown;
}

/** Alt texts of the seed images' Media rows. */
@Injectable()
export class MediaAltSeedRepository {
  constructor(private readonly database: DatabaseService) {}

  /** The rows among `ids` (the seed images of this run: at most a dozen). */
  findAlts(ids: readonly string[]): Promise<StoredMediaAlt[]> {
    return this.database.client.media.findMany({ where: { id: { in: [...ids] } }, select: { id: true, alt: true } });
  }

  async updateAlt(id: string, alt: LocalizedText): Promise<void> {
    await this.database.client.media.update({ where: { id }, data: { alt }, select: { id: true } });
  }
}
