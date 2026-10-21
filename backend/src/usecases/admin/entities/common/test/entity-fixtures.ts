import { randomBytes } from 'node:crypto';

import { DatabaseService } from '~database';

/** Rows of one e2e file: two collections (two products in the first, one in the second), a news item, a menu item. */
export interface EntityFixtureRows {
  readonly collectionIds: readonly [string, string];
  /** Products of the first collection */
  readonly productIds: readonly [string, string];
  /** The product of the second collection */
  readonly otherProductId: string;
  readonly newsId: string;
  readonly menuItemId: string;
}

/** Throw-away admin list rows in the test database (unique slugs per run), removed by `remove()`. */
export class EntityFixtures {
  private constructor(
    private readonly database: DatabaseService,
    readonly rows: EntityFixtureRows,
  ) {}

  static async create(database: DatabaseService): Promise<EntityFixtures> {
    const tag = randomBytes(6).toString('hex');
    const catalog = await EntityFixtures.createCatalog(database, tag);
    const newsId = await EntityFixtures.createNews(database, tag);
    const menuItemId = await EntityFixtures.createMenuItem(database, tag);
    return new EntityFixtures(database, { ...catalog, newsId, menuItemId });
  }

  async remove(): Promise<void> {
    const { client } = this.database;
    await client.collection.deleteMany({ where: { id: { in: [...this.rows.collectionIds] } } });
    await client.newsItem.deleteMany({ where: { id: this.rows.newsId } });
    await client.menuItem.deleteMany({ where: { id: this.rows.menuItemId } });
  }

  private static async createCatalog(
    database: DatabaseService,
    tag: string,
  ): Promise<Pick<EntityFixtureRows, 'collectionIds' | 'productIds' | 'otherProductId'>> {
    const [first, second] = await EntityFixtures.createCollections(database, tag);
    const [productA, productB] = await EntityFixtures.createProducts(database, { tag, collectionId: first, count: 2 });
    const others = { tag: `${tag}-b`, collectionId: second, count: 1 };
    const [otherProductId] = await EntityFixtures.createProducts(database, others);
    return { collectionIds: [first, second], productIds: [productA, productB], otherProductId };
  }

  private static async createCollections(database: DatabaseService, tag: string): Promise<string[]> {
    const created = await database.client.collection.createManyAndReturn({
      data: [`${tag}-a`, `${tag}-b`].map((slug, order) => ({ slug: `e2e-${slug}`, title: { ru: slug }, order })),
      select: { id: true, order: true },
    });
    return created.sort((left, right) => left.order - right.order).map(row => row.id);
  }

  private static async createProducts(
    database: DatabaseService,
    { tag, collectionId, count }: { tag: string; collectionId: string; count: number },
  ): Promise<string[]> {
    const created = await database.client.product.createManyAndReturn({
      data: Array.from({ length: count }, (_, order) => ({
        slug: `e2e-${tag}-p${order}`,
        collectionId,
        title: { ru: tag },
        order,
      })),
      select: { id: true, order: true },
    });
    return created.sort((left, right) => left.order - right.order).map(row => row.id);
  }

  private static async createMenuItem(database: DatabaseService, tag: string): Promise<string> {
    const item = await database.client.menuItem.create({
      data: { label: { ru: tag }, href: '#catalog' },
      select: { id: true },
    });
    return item.id;
  }

  private static async createNews(database: DatabaseService, tag: string): Promise<string> {
    const news = await database.client.newsItem.create({
      data: { slug: `e2e-${tag}`, title: { ru: tag }, date: new Date() },
      select: { id: true },
    });
    return news.id;
  }
}
