import { PrismaClient } from '~prisma-generated/prisma/client';

/**
 * Every row the seed writes, with its timestamps — two equal snapshots around a run prove that the run
 * changed nothing (no create, no update, no touched updatedAt).
 */
export class SeedTestSnapshot {
  static async take(client: PrismaClient): Promise<Partial<Record<string, readonly unknown[]>>> {
    const groups = await Promise.all([
      SeedTestSnapshot.takeTexts(client),
      SeedTestSnapshot.takeCatalog(client),
      SeedTestSnapshot.takeContent(client),
      SeedTestSnapshot.takeSite(client),
    ]);
    return Object.assign({}, ...groups);
  }

  private static async takeTexts(client: PrismaClient): Promise<Record<string, readonly unknown[]>> {
    const [users, messages, media, contentImages] = await Promise.all([
      client.user.findMany({ orderBy: { id: 'asc' } }),
      client.message.findMany({ orderBy: [{ locale: 'asc' }, { key: 'asc' }] }),
      client.media.findMany({ orderBy: { id: 'asc' } }),
      client.contentImage.findMany({ orderBy: { key: 'asc' } }),
    ]);
    return { users, messages, media, contentImages };
  }

  private static async takeCatalog(client: PrismaClient): Promise<Record<string, readonly unknown[]>> {
    const [collections, products, productImages, reviews] = await Promise.all([
      client.collection.findMany({ orderBy: { id: 'asc' } }),
      client.product.findMany({ orderBy: { id: 'asc' } }),
      client.productImage.findMany({ orderBy: { id: 'asc' } }),
      client.review.findMany({ orderBy: { id: 'asc' } }),
    ]);
    return { collections, products, productImages, reviews };
  }

  private static async takeContent(client: PrismaClient): Promise<Record<string, readonly unknown[]>> {
    const [news, gallery, offers, partners] = await Promise.all([
      client.newsItem.findMany({ orderBy: { id: 'asc' } }),
      client.galleryItem.findMany({ orderBy: { id: 'asc' } }),
      client.offer.findMany({ orderBy: { id: 'asc' } }),
      client.partner.findMany({ orderBy: { id: 'asc' } }),
    ]);
    return { news, gallery, offers, partners };
  }

  private static async takeSite(client: PrismaClient): Promise<Record<string, readonly unknown[]>> {
    const [menu, socialLinks, settings] = await Promise.all([
      client.menuItem.findMany({ orderBy: { id: 'asc' } }),
      client.socialLink.findMany({ orderBy: { id: 'asc' } }),
      client.siteSettings.findMany(),
    ]);
    return { menu, socialLinks, settings };
  }
}
