import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

import { DemoRowUpsert } from './demo-row.upsert';

export type CollectionSeedData = Omit<Prisma.CollectionUncheckedCreateInput, 'slug' | 'products'>;
export type ProductSeedData = Omit<Prisma.ProductUncheckedCreateInput, 'slug' | 'images'>;

/** A product photo: Media.id + its position. */
export interface ProductImageSeed {
  readonly mediaId: string;
  readonly order: number;
}

/** A demo product with its photos. */
export interface ProductSeed {
  readonly slug: string;
  readonly data: ProductSeedData;
  readonly images: readonly ProductImageSeed[];
}

/** The demo collection and its products. */
@Injectable()
export class CatalogSeedRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Returns the collection's id. */
  async upsertCollection({ key: slug, data, update }: DemoRowUpsert<string, CollectionSeedData>): Promise<string> {
    const create = { slug, ...data };
    const row = await this.database.client.collection.upsert({ where: { slug }, create, update, select: { id: true } });
    return row.id;
  }

  async findProductId(slug: string): Promise<string | null> {
    const row = await this.database.client.product.findUnique({ where: { slug }, select: { id: true } });
    return row?.id ?? null;
  }

  /** A new product together with its photos (photos are attached only to a newly created product). */
  async createProduct({ slug, data, images }: ProductSeed): Promise<void> {
    await this.database.client.product.create({
      data: { slug, ...data, images: { create: [...images] } },
      select: { id: true },
    });
  }

  /** SEED_OVERWRITE=1: the product and its photo set become exactly the seed again. */
  async resetProduct(id: string, { data, images }: Omit<ProductSeed, 'slug'>): Promise<void> {
    const { client } = this.database;
    await client.$transaction([
      client.product.update({ where: { id }, data, select: { id: true } }),
      client.productImage.deleteMany({ where: { productId: id } }),
      client.productImage.createMany({ data: images.map(image => ({ productId: id, ...image })) }),
    ]);
  }
}
