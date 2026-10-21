import { randomBytes } from 'node:crypto';

import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';
import { SocialType } from '~core/socials/social-type';
import { DatabaseService } from '~database';
import { TestMediaRows } from '~usecases/admin/site-texts/common/test/test-media-rows';

/** A lead of a test. */
export interface TestLead {
  readonly status: LeadStatus;
  readonly telegramSent: boolean;
  readonly message?: string;
  readonly createdAt?: Date;
}

/** Rows the dashboard counts, created by one e2e test and removed by `remove()`. */
export class DashboardFixtures {
  private readonly tag = randomBytes(6).toString('hex');
  private readonly leadIds: string[] = [];
  private readonly collectionIds: string[] = [];
  private readonly menuItemIds: string[] = [];
  private readonly socialLinkIds: string[] = [];
  private readonly media: TestMediaRows;

  constructor(private readonly database: DatabaseService) {
    this.media = new TestMediaRows(database);
  }

  async createLead(lead: TestLead): Promise<string> {
    const { status, telegramSent, message = 'E2E', createdAt } = lead;
    const data = { type: LeadType.CONTACT, name: `E2E ${this.tag}`, email: 'e2e@example.com', locale: 'ru' };
    const created = await this.database.client.lead.create({
      data: { ...data, status, telegramSent, message, createdAt },
      select: { id: true },
    });
    this.leadIds.push(created.id);
    return created.id;
  }

  /** Two collections: one on the site, one hidden. */
  async createCollections(): Promise<void> {
    const rows = await this.database.client.collection.createManyAndReturn({
      data: [true, false].map(published => ({
        slug: `e2e-${this.tag}-${published}`,
        title: { ru: this.tag },
        published,
      })),
      select: { id: true },
    });
    this.collectionIds.push(...rows.map(row => row.id));
  }

  /** A hidden menu item. */
  async createMenuItem(): Promise<void> {
    const item = await this.database.client.menuItem.create({
      data: { label: { ru: this.tag }, href: '#catalog', published: false },
      select: { id: true },
    });
    this.menuItemIds.push(item.id);
  }

  /** Two social links: one on the site, one hidden. */
  async createSocialLinks(): Promise<void> {
    const rows = await this.database.client.socialLink.createManyAndReturn({
      data: [true, false].map(published => ({ type: SocialType.WEBSITE, url: 'https://example.com', published })),
      select: { id: true },
    });
    this.socialLinkIds.push(...rows.map(row => row.id));
  }

  createMedia(adminId: string): Promise<string> {
    return this.media.create(adminId);
  }

  async remove(): Promise<void> {
    const { client } = this.database;
    await client.lead.deleteMany({ where: { id: { in: this.leadIds } } });
    await client.collection.deleteMany({ where: { id: { in: this.collectionIds } } });
    await client.menuItem.deleteMany({ where: { id: { in: this.menuItemIds } } });
    await client.socialLink.deleteMany({ where: { id: { in: this.socialLinkIds } } });
    await this.media.remove();
  }
}
