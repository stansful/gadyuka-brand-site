import { Injectable } from '@nestjs/common';

import type { AdminProductGroup, AdminProductListItem } from '~shared/contracts/catalog';

import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { CATALOG_LIST_LIMIT, CATALOG_LIST_ORDER } from '~usecases/admin/catalog/common/catalog-list.constants';
import { MediaRefRecord, MediaRefRow } from '~usecases/admin/common/media/media-ref.record';

interface ProductListRow {
  readonly id: string;
  readonly slug: string;
  readonly title: unknown;
  readonly price: number | null;
  readonly published: boolean;
  readonly images: ReadonlyArray<{ readonly media: MediaRefRow }>;
  readonly _count: { readonly images: number };
}

interface ProductGroupRow {
  readonly id: string;
  readonly slug: string;
  readonly title: unknown;
  readonly published: boolean;
  readonly products: readonly ProductListRow[];
}

@Injectable()
export class ProductListRepository {
  private static readonly PRODUCT_SELECT = {
    id: true,
    slug: true,
    title: true,
    price: true,
    published: true,
    images: { orderBy: { order: 'asc' }, take: 1, select: { media: { select: MediaRefRecord.SELECT } } },
    _count: { select: { images: true } },
  } as const;

  private static readonly GROUP_SELECT = {
    id: true,
    slug: true,
    title: true,
    published: true,
    products: {
      orderBy: CATALOG_LIST_ORDER,
      take: CATALOG_LIST_LIMIT,
      select: ProductListRepository.PRODUCT_SELECT,
    },
  } as const;

  constructor(private readonly database: DatabaseService) {}

  /** Every collection (list order) with its products (list order within the collection). */
  async findGroups(): Promise<AdminProductGroup[]> {
    const rows = await this.database.client.collection.findMany({
      orderBy: CATALOG_LIST_ORDER,
      take: CATALOG_LIST_LIMIT,
      select: ProductListRepository.GROUP_SELECT,
    });
    return rows.map(row => this.toGroup(row));
  }

  private toGroup({ products, ...collection }: ProductGroupRow): AdminProductGroup {
    return {
      collection: { ...collection, title: LocalizedTextValue.parse(collection.title) },
      products: products.map(product => this.toItem(product)),
    };
  }

  private toItem({ id, slug, title, price, published, images, _count }: ProductListRow): AdminProductListItem {
    const [first] = images;
    return {
      id,
      slug,
      title: LocalizedTextValue.parse(title),
      price,
      published,
      cover: first === undefined ? null : MediaRefRecord.toMediaRef(first.media),
      imageCount: _count.images,
    };
  }
}
