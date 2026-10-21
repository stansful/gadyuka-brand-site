import { randomBytes, randomUUID } from 'node:crypto';

import { MEDIA_FILE_NAME, MEDIA_MIME, MEDIA_URL_PREFIX } from '~core/media/media.constants';
import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

/** One collection of a catalog e2e file. */
export interface FixtureCollection {
  readonly id: string;
  readonly slug: string;
}

/**
 * Throw-away catalog rows of one e2e file in the test database: media rows owned by the test admin
 * (no file in the bucket — the catalog only references them), collections and products with unique
 * slugs, reviews with a unique author — made here or through the API with `slug()` / `author()`.
 * `remove()` deletes them all (products go with their collections; covers, avatars and an OG image
 * become null) — call it before the admin is removed (media rows restrict deleting their owner).
 */
export class CatalogFixtures {
  private static readonly FILE = { mime: MEDIA_MIME, width: 1200, height: 800, size: 1024 };
  private readonly mediaIds: string[] = [];
  /** Unique per file and run: prefix of every slug and review author made here (also through the API) */
  readonly tag = `e2e-${randomBytes(5).toString('hex')}`;

  constructor(
    private readonly database: DatabaseService,
    private readonly ownerId: string,
  ) {}

  /** A unique slug of this file ("e2e-<tag>-<name>"). */
  slug(name: string): string {
    return `${this.tag}-${name}`;
  }

  async createMedia(alt: Record<string, string> = { ru: 'Фото' }): Promise<string> {
    const media = await this.database.client.media.create({ data: this.mediaRow(alt), select: { id: true } });
    this.mediaIds.push(media.id);
    return media.id;
  }

  async createCollection(name: string, order = 0): Promise<FixtureCollection> {
    const slug = this.slug(name);
    const row = await this.database.client.collection.create({
      data: { slug, title: { ru: name }, order },
      select: { id: true },
    });
    return { id: row.id, slug };
  }

  async createProduct(collectionId: string, name: string, order = 0): Promise<string> {
    const row = await this.database.client.product.create({
      data: { slug: this.slug(name), collectionId, title: { ru: name }, order },
      select: { id: true },
    });
    return row.id;
  }

  async createReview(rating: number | null, order = 0): Promise<string> {
    const row = await this.database.client.review.create({
      data: { author: this.author('fixture'), text: { ru: 'Отлично' }, rating, order },
      select: { id: true },
    });
    return row.id;
  }

  /** A review author of this file (removed with the fixtures). */
  author(name: string): string {
    return `${this.tag} ${name}`;
  }

  async remove(): Promise<void> {
    const { client } = this.database;
    await client.collection.deleteMany({ where: { slug: { startsWith: this.tag } } });
    await client.review.deleteMany({ where: { author: { startsWith: this.tag } } });
    await client.media.deleteMany({ where: { id: { in: this.mediaIds } } });
  }

  private mediaRow(alt: Record<string, string>): Prisma.MediaUncheckedCreateInput {
    const uuid = randomUUID();
    const key = `admin/${this.ownerId}/${uuid}/${MEDIA_FILE_NAME}`;
    const owner = { ownerType: UserRole.ADMIN, ownerId: this.ownerId };
    return { ...owner, uuid, bucket: 'e2e', key, url: `${MEDIA_URL_PREFIX}/${key}`, alt, ...CatalogFixtures.FILE };
  }
}
