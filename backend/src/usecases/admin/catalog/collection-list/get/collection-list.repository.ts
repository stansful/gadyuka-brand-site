import { Injectable } from '@nestjs/common';

import type { AdminCollectionListItem } from '~shared/contracts/catalog';

import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { CATALOG_LIST_LIMIT, CATALOG_LIST_ORDER } from '~usecases/admin/catalog/common/catalog-list.constants';
import { MediaRefRecord, MediaRefRow } from '~usecases/admin/common/media/media-ref.record';

interface CollectionListRow {
  readonly id: string;
  readonly slug: string;
  readonly title: unknown;
  readonly published: boolean;
  readonly cover: MediaRefRow | null;
  readonly _count: { readonly products: number };
}

@Injectable()
export class CollectionListRepository {
  private static readonly SELECT = {
    id: true,
    slug: true,
    title: true,
    published: true,
    cover: { select: MediaRefRecord.SELECT },
    _count: { select: { products: true } },
  } as const;

  constructor(private readonly database: DatabaseService) {}

  /** Every collection in list order, with its cover and number of products. */
  async findAll(): Promise<AdminCollectionListItem[]> {
    const rows = await this.database.client.collection.findMany({
      orderBy: CATALOG_LIST_ORDER,
      take: CATALOG_LIST_LIMIT,
      select: CollectionListRepository.SELECT,
    });
    return rows.map(row => this.toItem(row));
  }

  private toItem({ id, slug, title, published, cover, _count }: CollectionListRow): AdminCollectionListItem {
    return {
      id,
      slug,
      title: LocalizedTextValue.parse(title),
      published,
      cover: MediaRefRecord.toNullableMediaRef(cover),
      productCount: _count.products,
    };
  }
}
