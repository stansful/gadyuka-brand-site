import { ApiProperty } from '@nestjs/swagger';

import type { AdminPartnerListResponse } from '~shared/contracts/content-entities';

import { PartnerDetailsResponse } from '~usecases/admin/content/common/partners/partner-details.response';
import { PartnerRecord } from '~usecases/admin/content/common/partners/partner.records';

/** GET /admin/partners: every partner in the manual order. */
export class PartnerListResponse implements AdminPartnerListResponse {
  @ApiProperty({ type: [PartnerDetailsResponse] })
  items: PartnerDetailsResponse[];

  static of(records: readonly PartnerRecord[]): PartnerListResponse {
    return Object.assign(new PartnerListResponse(), {
      items: records.map(record => PartnerDetailsResponse.of(record)),
    });
  }
}
