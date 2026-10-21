import { randomBytes, randomUUID } from 'node:crypto';

import type { LocalizedText } from '~shared/contracts/common';

import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

/** Bucket written into test rows (their files are never stored). */
const TEST_BUCKET = 'gadyuka-media';
const TEST_IMAGE = { mime: 'image/webp', width: 10, height: 8, size: 100 } as const;

type CatalogUsage = 'collectionId' | 'productId' | 'reviewId';
type SectionUsage = 'galleryItemId' | 'offerId' | 'partnerId';

interface FileLocation {
  readonly uuid: string;
  readonly key: string;
}

/** A media row of a test (no stored file): its name is "<tag>-<name>", so a search by the tag finds the test's rows only. */
export interface TestMediaRow {
  readonly name?: string;
  readonly createdAt?: Date;
  readonly alt?: LocalizedText;
  /** Media.bucket (default: the dev / test bucket) */
  readonly bucket?: string;
}

/** A created media row: its id and the key its file would have. */
export interface TestMedia {
  readonly id: string;
  readonly key: string;
}

/** The rows that reference one media file (one per kind but the settings), created by `createUsages`. */
export interface TestMediaUsages {
  readonly collectionId: string;
  readonly productId: string;
  readonly reviewId: string;
  readonly newsId: string;
  readonly galleryItemId: string;
  readonly offerId: string;
  readonly partnerId: string;
  readonly contentKey: string;
}

/**
 * Throw-away media rows of one e2e file (owned by a TestAdmin, unique names per run) and rows that
 * reference them; `remove()` deletes the references, then the media rows (stored files are the
 * test's own business).
 */
export class MediaFixtures {
  private readonly mediaIds = new Set<string>();
  private readonly usages: TestMediaUsages[] = [];

  private constructor(
    private readonly database: DatabaseService,
    private readonly ownerId: string,
    readonly tag: string,
  ) {}

  static start(database: DatabaseService, ownerId: string): MediaFixtures {
    return new MediaFixtures(database, ownerId, `e2e-${randomBytes(6).toString('hex')}`);
  }

  async createMedia(row: TestMediaRow = {}): Promise<string> {
    return (await this.createMediaWithKey(row)).id;
  }

  async createMediaWithKey(media: TestMediaRow = {}): Promise<TestMedia> {
    const uuid = randomUUID();
    const key = `admin/${this.ownerId}/${uuid}/image.webp`;
    const row = await this.database.client.media.create({
      data: this.rowOf(media, { uuid, key }),
      select: { id: true },
    });
    this.track(row.id);
    return { id: row.id, key };
  }

  /** Media rows created by the app (uploads) that the test must clean up too. */
  track(mediaId: string): void {
    this.mediaIds.add(mediaId);
  }

  async createUsages(mediaId: string): Promise<TestMediaUsages> {
    const [catalog, content] = await Promise.all([
      this.createCatalogUsages(mediaId),
      this.createContentUsages(mediaId),
    ]);
    const usages = { ...catalog, ...content };
    this.usages.push(usages);
    return usages;
  }

  async remove(): Promise<void> {
    await Promise.all(this.usages.map(usages => this.removeUsages(usages)));
    await this.database.client.media.deleteMany({ where: { id: { in: [...this.mediaIds] } } });
  }

  private rowOf(
    { name = 'photo.jpg', createdAt, alt = {}, bucket = TEST_BUCKET }: TestMediaRow,
    { uuid, key }: FileLocation,
  ): Prisma.MediaUncheckedCreateInput {
    const file = { ownerType: UserRole.ADMIN, ownerId: this.ownerId, uuid, bucket, key, url: `/media/${key}` };
    return { ...file, ...TEST_IMAGE, alt: { ...alt }, originalName: `${this.tag}-${name}`, createdAt };
  }

  private async createCatalogUsages(mediaId: string): Promise<Pick<TestMediaUsages, CatalogUsage>> {
    const collectionId = await this.createCollection(mediaId);
    const product = await this.database.client.product.create({
      data: { slug: `${this.tag}-p`, collectionId, title: { ru: 'Худи' }, images: { create: { mediaId } } },
      select: { id: true },
    });
    const review = await this.database.client.review.create({
      data: { author: 'Анна', text: { ru: 'Круто' }, avatarId: mediaId },
      select: { id: true },
    });
    return { collectionId, productId: product.id, reviewId: review.id };
  }

  /** A collection whose stored title has spaces around it (the usage title is trimmed). */
  private async createCollection(mediaId: string): Promise<string> {
    const collection = await this.database.client.collection.create({
      data: { slug: this.tag, title: { ru: ` Коллекция ${this.tag} ` }, coverId: mediaId },
      select: { id: true },
    });
    return collection.id;
  }

  /** A landing image, news, an untitled gallery photo, an offer without a Russian title, a partner. */
  private async createContentUsages(mediaId: string): Promise<Omit<TestMediaUsages, CatalogUsage>> {
    const { client } = this.database;
    const contentKey = `${this.tag}.image`;
    await client.contentImage.create({ data: { key: contentKey, mediaId } });
    const newsData = { slug: this.tag, title: { ru: 'Новость' }, date: new Date(), imageId: mediaId };
    const news = await client.newsItem.create({ data: newsData, select: { id: true } });
    return { contentKey, newsId: news.id, ...(await this.createSectionUsages(mediaId)) };
  }

  private async createSectionUsages(mediaId: string): Promise<Pick<TestMediaUsages, SectionUsage>> {
    const { client } = this.database;
    const gallery = await client.galleryItem.create({ data: { mediaId }, select: { id: true } });
    const offer = await client.offer.create({
      data: { title: { en: 'Sale' }, imageId: mediaId },
      select: { id: true },
    });
    const partner = await client.partner.create({ data: { name: 'Ателье', logoId: mediaId }, select: { id: true } });
    return { galleryItemId: gallery.id, offerId: offer.id, partnerId: partner.id };
  }

  private async removeUsages(usages: TestMediaUsages): Promise<void> {
    const { client } = this.database;
    await client.collection.deleteMany({ where: { id: usages.collectionId } });
    await client.review.deleteMany({ where: { id: usages.reviewId } });
    await client.contentImage.deleteMany({ where: { key: usages.contentKey } });
    await client.newsItem.deleteMany({ where: { id: usages.newsId } });
    await client.galleryItem.deleteMany({ where: { id: usages.galleryItemId } });
    await client.offer.deleteMany({ where: { id: usages.offerId } });
    await client.partner.deleteMany({ where: { id: usages.partnerId } });
  }
}
