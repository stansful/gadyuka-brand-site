import { Injectable } from '@nestjs/common';

import { PUBLIC_LIST_LIMITS } from '~core/public-content/public-content.constants';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

import { MANUAL_ORDER, PUBLIC_MEDIA_SELECT, PublicMediaRow } from './public-media.select';

const PRODUCT_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  details: true,
  price: true,
  images: {
    orderBy: { order: 'asc' },
    take: PUBLIC_LIST_LIMITS.productImages,
    select: { media: { select: PUBLIC_MEDIA_SELECT } },
  },
} satisfies Prisma.ProductSelect;

const COLLECTION_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  cover: { select: PUBLIC_MEDIA_SELECT },
  products: {
    where: { published: true },
    orderBy: MANUAL_ORDER,
    take: PUBLIC_LIST_LIMITS.productsPerCollection,
    select: PRODUCT_SELECT,
  },
} satisfies Prisma.CollectionSelect;

/** A published product as read for the site (LocalizedText fields as stored). */
export interface PublicProductRow {
  readonly id: string;
  readonly slug: string;
  readonly title: unknown;
  readonly description: unknown;
  readonly details: unknown;
  readonly price: number | null;
  readonly images: ReadonlyArray<{ readonly media: PublicMediaRow }>;
}

/** A published collection with its published products (ordered, bounded). */
export interface PublicCollectionRow {
  readonly id: string;
  readonly slug: string;
  readonly title: unknown;
  readonly description: unknown;
  readonly cover: PublicMediaRow | null;
  readonly products: readonly PublicProductRow[];
}

/** Published collections — the landing's catalog, a collection page, the list of slugs. */
@Injectable()
export class PublishedCollectionsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** The catalog of the landing: the first published collections in the admin's order. */
  findAll(): Promise<PublicCollectionRow[]> {
    return this.database.client.collection.findMany({
      where: { published: true },
      orderBy: MANUAL_ORDER,
      take: PUBLIC_LIST_LIMITS.collections,
      select: COLLECTION_SELECT,
    });
  }

  /** One published collection (null: no such slug, or hidden). */
  findBySlug(slug: string): Promise<PublicCollectionRow | null> {
    return this.database.client.collection.findFirst({
      where: { slug, published: true },
      select: COLLECTION_SELECT,
    });
  }

  /** Slugs of the published collections in the admin's order. */
  async findSlugs(): Promise<string[]> {
    const rows = await this.database.client.collection.findMany({
      where: { published: true },
      orderBy: MANUAL_ORDER,
      take: PUBLIC_LIST_LIMITS.collectionSlugs,
      select: { slug: true },
    });
    return rows.map(row => row.slug);
  }
}
