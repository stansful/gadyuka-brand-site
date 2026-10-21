import { ApiProperty } from '@nestjs/swagger';

import type {
  DashboardLeadsSummary,
  DashboardResponse as DashboardResponseContract,
  DashboardTextsSummary,
} from '~shared/contracts/dashboard';

import { EntityKind } from '~core/entities/entity-kind.enum';
import { SiteTextCounters } from '~core/site-texts/site-text-counters';

import { DashboardLeadResponse } from './dashboard-lead.response';
import { DashboardLeadRow, EntityCount, LeadCounts } from './dashboard.repository';

/** What the dashboard is built from. */
export interface DashboardFigures {
  readonly entities: Record<EntityKind, EntityCount>;
  readonly media: number;
  readonly texts: SiteTextCounters;
  readonly leads: LeadCounts;
  readonly latestLeads: readonly DashboardLeadRow[];
}

const COUNT = { type: 'number' } as const;

/** Answer of GET /admin/dashboard. */
export class DashboardResponse implements DashboardResponseContract {
  @ApiProperty({
    type: 'object',
    description: 'Per admin list (collection, product, review, news, gallery, offer, partner, menuItem, socialLink)',
    additionalProperties: { type: 'object', properties: { total: COUNT, published: COUNT } },
  })
  entities: Record<EntityKind, EntityCount>;

  @ApiProperty({ description: 'Files in the media library' })
  media: number;

  @ApiProperty({
    type: 'object',
    description: '«Тексты сайта»: edited = changed in the admin, gaps = no translation, unsaved = no row',
    properties: { total: COUNT, edited: COUNT, gaps: COUNT, unsaved: COUNT },
  })
  texts: DashboardTextsSummary;

  @ApiProperty({
    type: 'object',
    description: 'fresh = status NEW, telegramFailed = not delivered (spam aside)',
    properties: { total: COUNT, fresh: COUNT, telegramFailed: COUNT },
  })
  leads: DashboardLeadsSummary;

  @ApiProperty({ type: () => [DashboardLeadResponse], description: 'The newest leads first' })
  latestLeads: DashboardLeadResponse[];

  static of(figures: DashboardFigures): DashboardResponse {
    const { total, edited, gaps, unsaved } = figures.texts;
    return Object.assign(new DashboardResponse(), {
      entities: figures.entities,
      media: figures.media,
      texts: { total, edited, gaps, unsaved },
      leads: { ...figures.leads },
      latestLeads: figures.latestLeads.map(row => DashboardLeadResponse.of(row)),
    });
  }
}
