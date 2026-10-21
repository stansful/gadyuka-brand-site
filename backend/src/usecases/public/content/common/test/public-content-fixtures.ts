import { randomBytes, randomUUID } from 'node:crypto';

import { MEDIA_FILE_NAME, MEDIA_MIME, MEDIA_URL_PREFIX } from '~core/media/media.constants';
import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

/** Rows an e2e file created, by table (removed by `remove()`). */
interface CreatedRows {
  readonly media: string[];
  readonly collections: string[];
  readonly reviews: string[];
  readonly news: string[];
  readonly gallery: string[];
  readonly offers: string[];
  readonly partners: string[];
  readonly menuItems: string[];
  readonly socialLinks: string[];
  readonly contentImageKeys: string[];
  readonly messages: Array<{ key: string; locale: string }>;
}

type Data<T> = Partial<T>;

/**
 * Throw-away public content in the test database for one e2e file: unique slugs per run (`tag`),
 * media rows owned by `ownerId` (a TestAdmin — no files in storage: the API only reads the rows).
 * Tests that share a database with other e2e files give their rows a very low `order`, so the
 * bounded public lists start with them.
 */
export class PublicContentFixtures {
  /** What a stored 4×3 WebP would be (no object in storage: the public API never reads the file). */
  private static readonly FILE = { mime: MEDIA_MIME, width: 4, height: 3, size: 64 };
  readonly tag = randomBytes(6).toString('hex');
  private readonly created: CreatedRows = {
    media: [],
    collections: [],
    reviews: [],
    news: [],
    gallery: [],
    offers: [],
    partners: [],
    menuItems: [],
    socialLinks: [],
    contentImageKeys: [],
    messages: [],
  };
  private slugCount = 0;

  constructor(
    private readonly database: DatabaseService,
    private readonly ownerId: string,
  ) {}

  /** A slug no other run uses ("e2e-<tag>-<n>"). */
  nextSlug(): string {
    this.slugCount += 1;
    return `e2e-${this.tag}-${this.slugCount}`;
  }

  async createMedia(data: Data<Prisma.MediaUncheckedCreateInput> = {}): Promise<string> {
    const row = await this.database.client.media.create({
      data: { ...this.mediaData(), ...data },
      select: { id: true },
    });
    this.created.media.push(row.id);
    return row.id;
  }

  async createCollection(data: Data<Prisma.CollectionUncheckedCreateInput> = {}): Promise<string> {
    const base = { slug: this.nextSlug(), title: { ru: this.tag } };
    const row = await this.database.client.collection.create({ data: { ...base, ...data }, select: { id: true } });
    this.created.collections.push(row.id);
    return row.id;
  }

  /** Removed with its collection (ON DELETE CASCADE). */
  async createProduct(collectionId: string, data: Data<Prisma.ProductUncheckedCreateInput> = {}): Promise<string> {
    const base = { slug: this.nextSlug(), collectionId, title: { ru: this.tag } };
    const row = await this.database.client.product.create({ data: { ...base, ...data }, select: { id: true } });
    return row.id;
  }

  /** Removed with its product. */
  async createProductImage(productId: string, mediaId: string, order: number): Promise<void> {
    await this.database.client.productImage.create({ data: { productId, mediaId, order }, select: { id: true } });
  }

  async createReview(data: Data<Prisma.ReviewUncheckedCreateInput> = {}): Promise<string> {
    const base = { author: `E2E ${this.tag}`, text: { ru: this.tag } };
    const row = await this.database.client.review.create({ data: { ...base, ...data }, select: { id: true } });
    this.created.reviews.push(row.id);
    return row.id;
  }

  async createNews(data: Data<Prisma.NewsItemUncheckedCreateInput> = {}): Promise<string> {
    const base = { slug: this.nextSlug(), title: { ru: this.tag }, date: new Date() };
    const row = await this.database.client.newsItem.create({ data: { ...base, ...data }, select: { id: true } });
    this.created.news.push(row.id);
    return row.id;
  }

  async createGalleryItem(mediaId: string, data: Data<Prisma.GalleryItemUncheckedCreateInput> = {}): Promise<string> {
    const row = await this.database.client.galleryItem.create({ data: { mediaId, ...data }, select: { id: true } });
    this.created.gallery.push(row.id);
    return row.id;
  }

  async createOffer(data: Data<Prisma.OfferUncheckedCreateInput> = {}): Promise<string> {
    const row = await this.database.client.offer.create({
      data: { title: { ru: this.tag }, ...data },
      select: { id: true },
    });
    this.created.offers.push(row.id);
    return row.id;
  }

  async createPartner(data: Data<Prisma.PartnerUncheckedCreateInput> = {}): Promise<string> {
    const row = await this.database.client.partner.create({ data: { name: this.tag, ...data }, select: { id: true } });
    this.created.partners.push(row.id);
    return row.id;
  }

  async createMenuItem(data: Data<Prisma.MenuItemUncheckedCreateInput> = {}): Promise<string> {
    const base = { label: { ru: this.tag }, href: '#catalog' };
    const row = await this.database.client.menuItem.create({ data: { ...base, ...data }, select: { id: true } });
    this.created.menuItems.push(row.id);
    return row.id;
  }

  async createSocialLink(data: Data<Prisma.SocialLinkUncheckedCreateInput> = {}): Promise<string> {
    const base = { type: 'TELEGRAM' as const, url: `https://t.me/e2e_${this.tag}` };
    const row = await this.database.client.socialLink.create({ data: { ...base, ...data }, select: { id: true } });
    this.created.socialLinks.push(row.id);
    return row.id;
  }

  /** A landing image slot with a key no other run uses ("e2e-<tag>-<n>.image"). */
  async createContentImage(mediaId: string | null): Promise<string> {
    const key = `${this.nextSlug()}.image`;
    await this.database.client.contentImage.create({ data: { key, mediaId }, select: { key: true } });
    this.created.contentImageKeys.push(key);
    return key;
  }

  /** A site message edit (the caller drops the SiteMessagesService cache); replaces a leftover row. */
  async saveMessage(key: string, locale: string, value: string): Promise<void> {
    await this.database.client.message.upsert({
      where: { key_locale: { key, locale } },
      create: { key, locale, value },
      update: { value },
      select: { key: true },
    });
    this.created.messages.push({ key, locale });
  }

  async remove(): Promise<void> {
    await this.removeEntities();
    await this.removeTexts();
    await this.database.client.media.deleteMany({ where: { id: { in: this.created.media } } });
  }

  private async removeEntities(): Promise<void> {
    const { client } = this.database;
    await client.galleryItem.deleteMany({ where: { id: { in: this.created.gallery } } });
    await client.collection.deleteMany({ where: { id: { in: this.created.collections } } });
    await client.review.deleteMany({ where: { id: { in: this.created.reviews } } });
    await client.newsItem.deleteMany({ where: { id: { in: this.created.news } } });
    await client.offer.deleteMany({ where: { id: { in: this.created.offers } } });
    await client.partner.deleteMany({ where: { id: { in: this.created.partners } } });
  }

  private async removeTexts(): Promise<void> {
    const { client } = this.database;
    await client.menuItem.deleteMany({ where: { id: { in: this.created.menuItems } } });
    await client.socialLink.deleteMany({ where: { id: { in: this.created.socialLinks } } });
    await client.contentImage.deleteMany({ where: { key: { in: this.created.contentImageKeys } } });
    await client.message.deleteMany({ where: { OR: this.created.messages } });
  }

  private mediaData(): Prisma.MediaUncheckedCreateInput {
    const uuid = randomUUID();
    const key = `${UserRole.ADMIN.toLowerCase()}/${this.ownerId}/${uuid}/${MEDIA_FILE_NAME}`;
    const owner = { ownerType: UserRole.ADMIN, ownerId: this.ownerId };
    return { ...owner, ...PublicContentFixtures.FILE, uuid, bucket: 'e2e', key, url: `${MEDIA_URL_PREFIX}/${key}` };
  }
}
