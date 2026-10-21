import { Injectable } from '@nestjs/common';

import { LeadStatus } from '~core/leads/lead-status';
import { DatabaseService } from '~database';

export interface LeadStatusChange {
  readonly id: string;
  readonly status: LeadStatus;
}

@Injectable()
export class LeadStatusRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Stores the status; an unknown id fails with Prisma's P2025 (→ 404 admin.errors.notFound). */
  updateStatus({ id, status }: LeadStatusChange): Promise<LeadStatusChange> {
    return this.database.client.lead.update({ where: { id }, data: { status }, select: { id: true, status: true } });
  }
}
