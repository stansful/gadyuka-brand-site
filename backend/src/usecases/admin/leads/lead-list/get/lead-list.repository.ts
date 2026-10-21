import { Injectable } from '@nestjs/common';

import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';
import { DatabaseService } from '~database';
import { LeadListItemRow } from '~usecases/admin/leads/common/lead-list-item.row';
import { LEAD_LIST_ITEM_SELECT } from '~usecases/admin/leads/common/lead-list-item.select';

/** Filters of the leads list; an absent one does not filter. */
export interface LeadFilter {
  readonly type?: LeadType;
  readonly status?: LeadStatus;
}

export interface RowRange {
  readonly offset: number;
  readonly limit: number;
}

/** Leads of the admin list: newest first (ties by id), indexes (type | status, created_at). */
@Injectable()
export class LeadListRepository {
  private static readonly ORDER = [{ createdAt: 'desc' }, { id: 'desc' }] as const;

  constructor(private readonly database: DatabaseService) {}

  countLeads({ type, status }: LeadFilter): Promise<number> {
    return this.database.client.lead.count({ where: { type, status } });
  }

  findLeads({ type, status }: LeadFilter, { offset, limit }: RowRange): Promise<LeadListItemRow[]> {
    return this.database.client.lead.findMany({
      where: { type, status },
      orderBy: [...LeadListRepository.ORDER],
      skip: offset,
      take: limit,
      select: LEAD_LIST_ITEM_SELECT,
    });
  }
}
