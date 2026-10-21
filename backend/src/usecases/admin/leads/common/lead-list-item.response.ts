import { ApiProperty } from '@nestjs/swagger';

import type { LeadListItem } from '~shared/contracts/leads';

import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';

import { LeadListItemMapper } from './lead-list-item.mapper';
import { LeadListItemRow } from './lead-list-item.row';

/** A row of the admin's leads list. */
export class LeadListItemResponse implements LeadListItem {
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

  @ApiProperty({ type: String, nullable: true, example: '+79001234567' })
  phone: string | null;

  @ApiProperty({ description: 'The message on one line, cut to 140 characters (+ «…»)' })
  preview: string;

  @ApiProperty({ example: 'ru' })
  locale: string;

  @ApiProperty()
  telegramSent: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static of(row: LeadListItemRow): LeadListItemResponse {
    return Object.assign(new LeadListItemResponse(), LeadListItemMapper.toItem(row));
  }
}
