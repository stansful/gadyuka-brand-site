import { ApiProperty } from '@nestjs/swagger';

import { IsIn } from 'class-validator';

import type { LeadStatusRequest } from '~shared/contracts/leads';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { LeadStatus } from '~core/leads/lead-status';
import { ValidationMessage } from '~exception';

/** Body of PATCH /admin/leads/:id/status. */
export class LeadStatusDto implements LeadStatusRequest {
  @ApiProperty({ enum: LeadStatus, example: LeadStatus.IN_PROGRESS })
  @IsIn(Object.values(LeadStatus), ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  status: LeadStatus;
}
