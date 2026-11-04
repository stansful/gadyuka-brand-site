import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsDateString, IsEnum } from 'class-validator';

import type { VisitsStatsQuery, VisitGranularity } from '~shared/contracts/visits';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';

const INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);

export class VisitsStatsDto implements VisitsStatsQuery {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD), inclusive' })
  @IsDateString(undefined, INVALID)
  from: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD), inclusive' })
  @IsDateString(undefined, INVALID)
  to: string;

  @ApiPropertyOptional({ enum: ['day', 'hour'], default: 'day' })
  @IsEnum(['day', 'hour'] as const, INVALID)
  @Type(() => String)
  granularity: VisitGranularity = 'day';
}
