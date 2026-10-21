import { Injectable, Logger } from '@nestjs/common';

import { DEFAULT_LOCALE } from '~core/locales/locale.enum';

import { DemoEntityCatalog, DemoProduct } from '../data/demo-entity.catalog';
import { SeedMode } from '../run/seed-mode.enum';
import { SeedOptions } from '../run/seed-options';
import { SeedMediaIds } from '../run/seed-run';
import { SeedUpdates } from '../run/seed-updates';
import { CatalogSeedRepository, ProductSeed } from './catalog-seed.repository';

/** The demo collection «Меня запомнят» and its products (with their photos). */
@Injectable()
export class CatalogSeeder {
  private static readonly PUBLISHED = true;

  private readonly logger = new Logger(CatalogSeeder.name);
  private readonly writeExistingProduct: Readonly<
    Record<SeedMode, (id: string, product: ProductSeed) => Promise<void>>
  >;

  constructor(
    private readonly options: SeedOptions,
    private readonly updates: SeedUpdates,
    private readonly catalog: DemoEntityCatalog,
    private readonly repository: CatalogSeedRepository,
  ) {
    this.writeExistingProduct = {
      // The product exists and was possibly edited in the admin: it (and its photos) stay as they are.
      [SeedMode.KEEP_EDITS]: async () => undefined,
      [SeedMode.OVERWRITE]: (id, product) => this.repository.resetProduct(id, product),
    };
  }

  async seed(media: SeedMediaIds): Promise<void> {
    const collectionId = await this.seedCollection(media);
    const products = this.catalog.products().map(product => this.toProductSeed(product, { collectionId, media }));
    for (const product of products) {
      await this.seedProduct(product);
    }
    const title = this.catalog.collection().title[DEFAULT_LOCALE];
    this.logger.log('CatalogSeeder : collection with products', { collection: title, products: products.length });
  }

  private async seedCollection(media: SeedMediaIds): Promise<string> {
    const { slug, title, description, cover, order } = this.catalog.collection();
    const data = { title, description, coverId: media[cover], order, published: CatalogSeeder.PUBLISHED };
    return this.repository.upsertCollection({ key: slug, data, update: this.updates.of(data) });
  }

  private async seedProduct(product: ProductSeed): Promise<void> {
    const existingId = await this.repository.findProductId(product.slug);
    if (existingId === null) {
      await this.repository.createProduct(product);
      return;
    }
    await this.writeExistingProduct[this.options.mode()](existingId, product);
  }

  private toProductSeed(
    product: DemoProduct,
    { collectionId, media }: { readonly collectionId: string; readonly media: SeedMediaIds },
  ): ProductSeed {
    const { slug, title, description, details, order } = product;
    const data = { collectionId, title, description, details, price: null, order, published: CatalogSeeder.PUBLISHED };
    const images = product.images.map((key, imageOrder) => ({ mediaId: media[key], order: imageOrder }));
    return { slug, data, images };
  }
}
