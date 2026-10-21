import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

import type { LeadListQuery } from '~shared/contracts/leads';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';
import { ValidationMessage } from '~exception';

const INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);

/** Query of GET /admin/leads: filters (the admin's selects offer only valid values) and the 1-based page. */
export class LeadListDto implements LeadListQuery {
  @ApiPropertyOptional({ enum: LeadType })
  @IsOptional()
  @IsIn(Object.values(LeadType), INVALID)
  type?: LeadType;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsIn(Object.values(LeadStatus), INVALID)
  status?: LeadStatus;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Past the last page → the last page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt(INVALID)
  @Min(1, INVALID)
  page?: number;
}
