import { ApiProperty } from '@nestjs/swagger';

import type { AdminOfferListResponse } from '~shared/contracts/content-entities';

import { OfferListRecord } from '~usecases/admin/content/common/offers/offer.records';

import { OfferListItemResponse } from './offer-list-item.response';

/** GET /admin/offers: every special offer in the manual order, expired ones flagged at `now`. */
export class OfferListResponse implements AdminOfferListResponse {
  @ApiProperty({ type: [OfferListItemResponse] })
  items: OfferListItemResponse[];

  static of(records: readonly OfferListRecord[], now: Date): OfferListResponse {
    return Object.assign(new OfferListResponse(), {
      items: records.map(record => OfferListItemResponse.of(record, now)),
    });
  }
}
