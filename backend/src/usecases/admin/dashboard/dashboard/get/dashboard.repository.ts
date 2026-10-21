import { Injectable } from '@nestjs/common';

import { EntityKind } from '~core/entities/entity-kind.enum';
import { EntityKinds } from '~core/entities/entity-kinds';
import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';
import { DatabaseService } from '~database';

/** Rows of an admin list and how many of them are published. */
export interface EntityCount {
  readonly total: number;
  readonly published: number;
}

export interface LeadCounts {
  readonly total: number;
  readonly fresh: number;
  readonly telegramFailed: number;
}

/** A lead as the dashboard lists it. */
export interface DashboardLeadRow {
  readonly id: string;
  readonly type: LeadType;
  readonly status: LeadStatus;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly message: string;
  readonly locale: string;
  readonly telegramSent: boolean;
  readonly createdAt: Date;
}

interface EntityCounter {
  total(): Promise<number>;
  published(): Promise<number>;
}

/** Counters of the admin home page (every count is one indexed or small-table query). */
@Injectable()
export class DashboardRepository {
  private static readonly PUBLISHED = { where: { published: true } } as const;
  private static readonly LEAD_SELECT = {
    id: true,
    type: true,
    status: true,
    name: true,
    email: true,
    phone: true,
    message: true,
    locale: true,
    telegramSent: true,
    createdAt: true,
  } as const;

  private readonly counters: Readonly<Record<EntityKind, EntityCounter>> = {
    [EntityKind.COLLECTION]: {
      total: () => this.database.client.collection.count(),
      published: () => this.database.client.collection.count(DashboardRepository.PUBLISHED),
    },
    [EntityKind.PRODUCT]: {
      total: () => this.database.client.product.count(),
      published: () => this.database.client.product.count(DashboardRepository.PUBLISHED),
    },
    [EntityKind.REVIEW]: {
      total: () => this.database.client.review.count(),
      published: () => this.database.client.review.count(DashboardRepository.PUBLISHED),
    },
    [EntityKind.NEWS]: {
      total: () => this.database.client.newsItem.count(),
      published: () => this.database.client.newsItem.count(DashboardRepository.PUBLISHED),
    },
    [EntityKind.GALLERY]: {
      total: () => this.database.client.galleryItem.count(),
      published: () => this.database.client.galleryItem.count(DashboardRepository.PUBLISHED),
    },
    [EntityKind.OFFER]: {
      total: () => this.database.client.offer.count(),
      published: () => this.database.client.offer.count(DashboardRepository.PUBLISHED),
    },
    [EntityKind.PARTNER]: {
      total: () => this.database.client.partner.count(),
      published: () => this.database.client.partner.count(DashboardRepository.PUBLISHED),
    },
    [EntityKind.MENU_ITEM]: {
      total: () => this.database.client.menuItem.count(),
      published: () => this.database.client.menuItem.count(DashboardRepository.PUBLISHED),
    },
    [EntityKind.SOCIAL_LINK]: {
      total: () => this.database.client.socialLink.count(),
      published: () => this.database.client.socialLink.count(DashboardRepository.PUBLISHED),
    },
  };

  constructor(private readonly database: DatabaseService) {}

  async countEntities(): Promise<Record<EntityKind, EntityCount>> {
    const counts = await Promise.all(EntityKinds.PUBLISHABLE.map(kind => this.countEntity(kind)));
    // Every kind was counted above.
    return Object.fromEntries(counts) as Record<EntityKind, EntityCount>;
  }

  countMedia(): Promise<number> {
    return this.database.client.media.count();
  }

  /** All leads, the NEW ones, and the ones Telegram did not get (spam aside). */
  async countLeads(): Promise<LeadCounts> {
    const leads = this.database.client.lead;
    const [total, fresh, telegramFailed] = await Promise.all([
      leads.count(),
      leads.count({ where: { status: LeadStatus.NEW } }),
      leads.count({ where: { telegramSent: false, status: { not: LeadStatus.SPAM } } }),
    ]);
    return { total, fresh, telegramFailed };
  }

  /** The newest leads first. */
  findLatestLeads(limit: number): Promise<DashboardLeadRow[]> {
    return this.database.client.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: DashboardRepository.LEAD_SELECT,
    });
  }

  private async countEntity(kind: EntityKind): Promise<readonly [EntityKind, EntityCount]> {
    const counter = this.counters[kind];
    const [total, published] = await Promise.all([counter.total(), counter.published()]);
    return [kind, { total, published }];
  }
}
