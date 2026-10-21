import { Injectable } from '@nestjs/common';

import { LeadStatus } from '~core/leads/lead-status';
import { DatabaseService } from '~database';

@Injectable()
export class DashboardNewLeadsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Leads with status NEW (index on status, created_at). */
  countNewLeads(): Promise<number> {
    return this.database.client.lead.count({ where: { status: LeadStatus.NEW } });
  }
}
