import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

import { DemoRowUpsert } from './demo-row.upsert';

export type ReviewSeedData = Omit<Prisma.ReviewUncheckedCreateInput, 'id'>;
export type NewsSeedData = Omit<Prisma.NewsItemUncheckedCreateInput, 'slug'>;
export type GallerySeedData = Omit<Prisma.GalleryItemUncheckedCreateInput, 'id'>;
export type OfferSeedData = Omit<Prisma.OfferUncheckedCreateInput, 'id'>;
export type PartnerSeedData = Omit<Prisma.PartnerUncheckedCreateInput, 'id'>;
export type MenuItemSeedData = Omit<Prisma.MenuItemUncheckedCreateInput, 'id'>;
export type SocialLinkSeedData = Omit<Prisma.SocialLinkUncheckedCreateInput, 'id'>;
export type SiteSettingsSeedData = Omit<Prisma.SiteSettingsUncheckedCreateInput, 'id'>;

/** Upserts of the demo rows (reviews, news, gallery, offers, partners, menu, social links, settings). */
@Injectable()
export class DemoEntitiesRepository {
  /** The singleton site settings row. */
  private static readonly SETTINGS_ID = 1;

  constructor(private readonly database: DatabaseService) {}

  async upsertReview({ key: id, data, update }: DemoRowUpsert<string, ReviewSeedData>): Promise<void> {
    await this.database.client.review.upsert({ where: { id }, create: { id, ...data }, update, select: { id: true } });
  }

  async upsertNews({ key: slug, data, update }: DemoRowUpsert<string, NewsSeedData>): Promise<void> {
    const create = { slug, ...data };
    await this.database.client.newsItem.upsert({ where: { slug }, create, update, select: { id: true } });
  }

  async upsertGalleryItem({ key: id, data, update }: DemoRowUpsert<string, GallerySeedData>): Promise<void> {
    const create = { id, ...data };
    await this.database.client.galleryItem.upsert({ where: { id }, create, update, select: { id: true } });
  }

  async upsertOffer({ key: id, data, update }: DemoRowUpsert<string, OfferSeedData>): Promise<void> {
    await this.database.client.offer.upsert({ where: { id }, create: { id, ...data }, update, select: { id: true } });
  }

  async upsertPartner({ key: id, data, update }: DemoRowUpsert<string, PartnerSeedData>): Promise<void> {
    await this.database.client.partner.upsert({ where: { id }, create: { id, ...data }, update, select: { id: true } });
  }

  async upsertMenuItem({ key: id, data, update }: DemoRowUpsert<string, MenuItemSeedData>): Promise<void> {
    await this.database.client.menuItem.upsert({
      where: { id },
      create: { id, ...data },
      update,
      select: { id: true },
    });
  }

  async upsertSocialLink({ key: id, data, update }: DemoRowUpsert<string, SocialLinkSeedData>): Promise<void> {
    const create = { id, ...data };
    await this.database.client.socialLink.upsert({ where: { id }, create, update, select: { id: true } });
  }

  async upsertSettings({ data, update }: Omit<DemoRowUpsert<number, SiteSettingsSeedData>, 'key'>): Promise<void> {
    const id = DemoEntitiesRepository.SETTINGS_ID;
    await this.database.client.siteSettings.upsert({
      where: { id },
      create: { id, ...data },
      update,
      select: { id: true },
    });
  }
}
