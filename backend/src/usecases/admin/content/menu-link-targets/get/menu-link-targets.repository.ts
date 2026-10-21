import { Injectable } from '@nestjs/common';

import type { AdminMenuCollectionTarget } from '~shared/contracts/content-entities';

import { MAX_ADMIN_LIST_ROWS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';

/** The collections the menu form offers as link targets. */
@Injectable()
export class MenuLinkTargetsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Every collection (published or not) in the catalog's manual order. */
  async findCollections(): Promise<AdminMenuCollectionTarget[]> {
    const rows = await this.database.client.collection.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      take: MAX_ADMIN_LIST_ROWS,
      select: { slug: true, title: true },
    });
    return rows.map(row => ({ slug: row.slug, title: LocalizedTextValue.parse(row.title) }));
  }
}
