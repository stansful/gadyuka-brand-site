import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { LeadListItemRow } from '~usecases/admin/leads/common/lead-list-item.row';
import { LEAD_LIST_ITEM_SELECT } from '~usecases/admin/leads/common/lead-list-item.select';

export interface LeadDetailRow extends LeadListItemRow {
  readonly telegramError: string | null;
  /** Lead.meta as stored (JSON) */
  readonly meta: unknown;
  readonly updatedAt: Date;
}

@Injectable()
export class LeadDetailRepository {
  constructor(private readonly database: DatabaseService) {}

  findLead(id: string): Promise<LeadDetailRow | null> {
    return this.database.client.lead.findUnique({
      where: { id },
      select: { ...LEAD_LIST_ITEM_SELECT, telegramError: true, meta: true, updatedAt: true },
    });
  }
}
