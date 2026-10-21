import { ApiProperty } from '@nestjs/swagger';

import type { DashboardLeadItem } from '~shared/contracts/dashboard';

import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';

import { DashboardLeadRow } from './dashboard.repository';

/** A lead of «Последние заявки». */
export class DashboardLeadResponse implements DashboardLeadItem {
  /** Length of the message preview (longer messages are cut and get «…»). */
  private static readonly PREVIEW_LENGTH = 140;
  private static readonly ELLIPSIS = '…';
  private static readonly WHITESPACE = /\s+/g;

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

  @ApiProperty({ description: 'The message with collapsed whitespace, ≤ 140 characters + «…»' })
  preview: string;

  @ApiProperty({ example: 'ru' })
  locale: string;

  @ApiProperty()
  telegramSent: boolean;

  @ApiProperty({ type: String, description: 'ISO 8601' })
  createdAt: string;

  static of(row: DashboardLeadRow): DashboardLeadResponse {
    const { message, createdAt, ...fields } = row;
    const preview = DashboardLeadResponse.previewOf(message);
    return Object.assign(new DashboardLeadResponse(), { ...fields, preview, createdAt: createdAt.toISOString() });
  }

  private static previewOf(message: string): string {
    const text = message.replace(DashboardLeadResponse.WHITESPACE, ' ').trim();
    const isLong = text.length > DashboardLeadResponse.PREVIEW_LENGTH;
    return isLong ? `${text.slice(0, DashboardLeadResponse.PREVIEW_LENGTH)}${DashboardLeadResponse.ELLIPSIS}` : text;
  }
}
