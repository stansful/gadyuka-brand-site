import { ApiProperty } from '@nestjs/swagger';

import type { LeadListResponse as LeadListResponseContract } from '~shared/contracts/leads';

import { LeadListPage } from '~core/leads/lead-list-page';
import { LeadListItemResponse } from '~usecases/admin/leads/common/lead-list-item.response';
import { LeadListItemRow } from '~usecases/admin/leads/common/lead-list-item.row';

/** Answer of GET /admin/leads: one page of the filtered list and the paging of the whole. */
export class LeadListResponse implements LeadListResponseContract {
  @ApiProperty({ type: [LeadListItemResponse] })
  items: LeadListItemResponse[];

  @ApiProperty({ description: '1-based, clamped to 1…pageCount' })
  page: number;

  @ApiProperty({ example: 25 })
  pageSize: number;

  @ApiProperty({ description: 'Leads matching the filters' })
  total: number;

  @ApiProperty({ minimum: 1 })
  pageCount: number;

  static of(rows: readonly LeadListItemRow[], page: LeadListPage, total: number): LeadListResponse {
    return Object.assign(new LeadListResponse(), {
      items: rows.map(row => LeadListItemResponse.of(row)),
      page: page.number,
      pageSize: page.size,
      total,
      pageCount: page.count,
    });
  }
}
