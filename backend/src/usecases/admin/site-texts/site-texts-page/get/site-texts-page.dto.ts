import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString } from 'class-validator';

import type { SiteTextsPageQuery } from '~shared/contracts/site-texts';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';

/**
 * Query of GET /admin/site-texts. Both are free text, as the admin's address bar allows: an unknown
 * section falls back to «hero», a long query is cut to its first 100 characters (SiteTextQuery).
 */
export class SiteTextsPageDto implements SiteTextsPageQuery {
  @ApiPropertyOptional({ description: 'Section = top-level namespace of the site messages', example: 'hero' })
  @IsOptional()
  @IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  section?: string;

  @ApiPropertyOptional({ description: 'Search across every section (key, label, current or default text)' })
  @IsOptional()
  @IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  q?: string;
}
