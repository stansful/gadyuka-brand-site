import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

import { SiteMessageDefault, StoredSiteMessage } from './site-message-seed.interfaces';

/**
 * Message rows for the seed. Read without a limit on purpose: the key set is shared/messages (a few
 * hundred keys per locale) and the seed must see every row to report orphans.
 */
@Injectable()
export class SiteMessageSeedRepository {
  constructor(private readonly database: DatabaseService) {}

  findAll(): Promise<StoredSiteMessage[]> {
    return this.database.client.message.findMany({ select: { key: true, locale: true, value: true, editedAt: true } });
  }

  async createDefaults(values: readonly SiteMessageDefault[]): Promise<void> {
    await this.database.client.message.createMany({ data: [...values], skipDuplicates: true });
  }

  /** Sets rows still owned by the seed: `editedAt: null` in the filter also protects a row the admin saved meanwhile. */
  async updateSeedOwned(values: readonly SiteMessageDefault[]): Promise<void> {
    const { client } = this.database;
    await client.$transaction(
      values.map(({ key, locale, value }) =>
        client.message.updateMany({ where: { key, locale, editedAt: null }, data: { value, editedAt: null } }),
      ),
    );
  }

  /** SEED_OVERWRITE=1: resets the rows to the default, edited ones too (editedAt cleared). */
  async resetToDefaults(values: readonly SiteMessageDefault[]): Promise<void> {
    const { client } = this.database;
    await client.$transaction(
      values.map(({ key, locale, value }) =>
        client.message.updateMany({ where: { key, locale }, data: { value, editedAt: null } }),
      ),
    );
  }
}
