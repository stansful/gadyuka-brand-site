import { Injectable, Logger } from '@nestjs/common';

import { DemoEntityCatalog } from '../data/demo-entity.catalog';
import { SeedMediaIds, SeedRun } from '../run/seed-run';
import { SeedScope } from '../run/seed-scope.enum';
import { SeedUpdates } from '../run/seed-updates';
import { SeedStep } from '../seed-step.interface';
import { CatalogSeeder } from './catalog.seeder';
import { DemoEntitiesRepository } from './demo-entities.repository';

/**
 * Demo entities: the collection «Меня запомнят» with products, reviews, news, gallery, offers, partners,
 * the menu, the social links and the settings. Seeded on a FULL run only (first run, or SEED_OVERWRITE=1):
 * afterwards they belong to the admin — deletions, renamed slugs, re-ordered photos and unpublished items
 * survive a re-seed. The site settings row is written last: it marks the database as seeded.
 */
@Injectable()
export class DemoEntitiesSeed implements SeedStep {
  private static readonly PUBLISHED = true;
  /** The header, mobile menu and footer list the same items. */
  private static readonly SHOWN = true;

  private readonly logger = new Logger(DemoEntitiesSeed.name);
  /** In order; the settings last (the row marks the database as seeded). */
  private readonly seeders: ReadonlyArray<(media: SeedMediaIds) => Promise<void>> = [
    media => this.catalogSeeder.seed(media),
    () => this.seedReviews(),
    media => this.seedNews(media),
    media => this.seedGallery(media),
    media => this.seedOffers(media),
    () => this.seedPartners(),
    () => this.seedMenu(),
    () => this.seedSocialLinks(),
    media => this.seedSettings(media),
  ];

  constructor(
    private readonly seedRun: SeedRun,
    private readonly updates: SeedUpdates,
    private readonly catalog: DemoEntityCatalog,
    private readonly catalogSeeder: CatalogSeeder,
    private readonly repository: DemoEntitiesRepository,
  ) {}

  async run(): Promise<void> {
    if (this.seedRun.scope() !== SeedScope.FULL) {
      this.logger.log('DemoEntitiesSeed : database already seeded — demo entities left as edited in the admin');
      return;
    }
    const media = this.seedRun.allMediaIds();
    for (const seed of this.seeders) {
      await seed(media);
    }
  }

  private async seedReviews(): Promise<void> {
    const reviews = this.catalog.reviews();
    for (const { id, author, role, text, rating, order } of reviews) {
      const data = { author, role, text, rating, order, published: DemoEntitiesSeed.PUBLISHED };
      await this.repository.upsertReview({ key: id, data, update: this.updates.of(data) });
    }
    this.logger.log('DemoEntitiesSeed : reviews', { count: reviews.length });
  }

  private async seedNews(media: SeedMediaIds): Promise<void> {
    const news = this.catalog.news();
    for (const { slug, title, excerpt, body, date, image } of news) {
      const data = { title, excerpt, body, date, imageId: media[image], published: DemoEntitiesSeed.PUBLISHED };
      await this.repository.upsertNews({ key: slug, data, update: this.updates.of(data) });
    }
    this.logger.log('DemoEntitiesSeed : news', { count: news.length });
  }

  private async seedGallery(media: SeedMediaIds): Promise<void> {
    const items = this.catalog.gallery();
    for (const { id, media: key, caption, order } of items) {
      const data = { mediaId: media[key], caption, order, published: DemoEntitiesSeed.PUBLISHED };
      await this.repository.upsertGalleryItem({ key: id, data, update: this.updates.of(data) });
    }
    this.logger.log('DemoEntitiesSeed : gallery', { count: items.length });
  }

  private async seedOffers(media: SeedMediaIds): Promise<void> {
    const offers = this.catalog.offers();
    for (const { id, image, ...offer } of offers) {
      const imageId = image === null ? null : media[image];
      const data = { ...offer, imageId, published: DemoEntitiesSeed.PUBLISHED };
      await this.repository.upsertOffer({ key: id, data, update: this.updates.of(data) });
    }
    this.logger.log('DemoEntitiesSeed : offers', { count: offers.length });
  }

  private async seedPartners(): Promise<void> {
    const partners = this.catalog.partners();
    for (const { id, name, description, order, published } of partners) {
      const data = { name, url: null, description, order, published };
      await this.repository.upsertPartner({ key: id, data, update: this.updates.of(data) });
    }
    this.logger.log('DemoEntitiesSeed : partners (drafts)', { count: partners.length });
  }

  private async seedMenu(): Promise<void> {
    const items = this.catalog.menu();
    const shown = { showInHeader: DemoEntitiesSeed.SHOWN, showInFooter: DemoEntitiesSeed.SHOWN };
    for (const { id, label, href, order } of items) {
      const data = { label, href, ...shown, order, published: DemoEntitiesSeed.PUBLISHED };
      await this.repository.upsertMenuItem({ key: id, data, update: this.updates.of(data) });
    }
    this.logger.log('DemoEntitiesSeed : menu items', { count: items.length });
  }

  private async seedSocialLinks(): Promise<void> {
    const links = this.catalog.socialLinks();
    for (const { id, ...link } of links) {
      await this.repository.upsertSocialLink({ key: id, data: link, update: this.updates.of(link) });
    }
    this.logger.log('DemoEntitiesSeed : social links (placeholder URL)', { count: links.length });
  }

  private async seedSettings(media: SeedMediaIds): Promise<void> {
    const { ogImage, ...settings } = this.catalog.settings();
    const data = { ...settings, ogImageId: media[ogImage] };
    await this.repository.upsertSettings({ data, update: this.updates.of(data) });
    this.logger.log('DemoEntitiesSeed : site settings (placeholder contacts)', {
      review_rating_max: data.reviewRatingMax,
    });
  }
}
