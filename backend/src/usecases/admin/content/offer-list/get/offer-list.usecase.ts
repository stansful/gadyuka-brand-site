import { Injectable } from '@nestjs/common';

import { Clock } from '~module/common';
import { OfferRepository } from '~usecases/admin/content/common/offers/offer.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { OfferListResponse } from './offer-list.response';

/** The admin's special offers (manual order; expired ones flagged). */
@Injectable()
export class OfferListUsecase implements Usecase<void, OfferListResponse> {
  constructor(
    private readonly repository: OfferRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<OfferListResponse> {
    const records = await this.repository.findList();
    return OfferListResponse.of(records, new Date(this.clock.now()));
  }
}
