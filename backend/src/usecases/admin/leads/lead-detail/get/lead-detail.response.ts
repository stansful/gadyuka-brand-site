import { ApiProperty } from '@nestjs/swagger';

import type { LeadDetailResponse as LeadDetailResponseContract } from '~shared/contracts/leads';

import { LeadMetaEntries } from '~core/leads/lead-meta-entries';
import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';
import { LeadListItemMapper } from '~usecases/admin/leads/common/lead-list-item.mapper';

import { LeadDetailRow } from './lead-detail.repository';

class LeadMetaEntryResponse {
  @ApiProperty({ example: 'consentAt' })
  key: string;

  @ApiProperty({ description: 'Strings as is, anything else as JSON' })
  value: string;
}

/** Answer of GET /admin/leads/:id: everything the admin's lead page shows. */
export class LeadDetailResponse implements LeadDetailResponseContract {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LeadType })
  type: LeadType;

  @ApiProperty({ enum: LeadStatus })
  status: LeadStatus;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  email: string | null;

  @ApiProperty({ type: String, nullable: true })
  phone: string | null;

  @ApiProperty({ description: 'The message on one line, cut to 140 characters (+ «…»)' })
  preview: string;

  @ApiProperty({ example: 'ru' })
  locale: string;

  @ApiProperty()
  telegramSent: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ description: 'The whole message ("" when none was written)' })
  message: string;

  @ApiProperty({ type: String, nullable: true, description: 'Why Telegram did not get the lead (owner-facing text)' })
  telegramError: string | null;

  @ApiProperty({ type: [LeadMetaEntryResponse], description: 'Lead.meta entries (at most 50)' })
  meta: LeadMetaEntryResponse[];

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  static of(row: LeadDetailRow): LeadDetailResponse {
    return Object.assign(new LeadDetailResponse(), LeadListItemMapper.toItem(row), {
      message: row.message,
      telegramError: row.telegramError,
      meta: LeadMetaEntries.of(row.meta),
      updatedAt: row.updatedAt.toISOString(),
    });
  }
}
