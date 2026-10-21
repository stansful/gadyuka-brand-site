import { ApiProperty } from '@nestjs/swagger';

import type { LeadStatusResponse as LeadStatusResponseContract } from '~shared/contracts/leads';

import { LeadStatus } from '~core/leads/lead-status';

import { LeadStatusChange } from './lead-status.repository';

/** Answer of PATCH /admin/leads/:id/status: the stored status. */
export class LeadStatusResponse implements LeadStatusResponseContract {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LeadStatus })
  status: LeadStatus;

  static of({ id, status }: LeadStatusChange): LeadStatusResponse {
    return Object.assign(new LeadStatusResponse(), { id, status });
  }
}
