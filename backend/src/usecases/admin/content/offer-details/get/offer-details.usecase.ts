import { Injectable } from '@nestjs/common';

import { ContentEntityNotFoundException } from '~usecases/admin/content/common/exceptions/content-entity-not-found.exception';
import { OfferDetailsResponse } from '~usecases/admin/content/common/offers/offer-details.response';
import { OfferRepository } from '~usecases/admin/content/common/offers/offer.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface OfferDetailsQuery {
  readonly id: string;
}

/** One special offer for the edit form. */
@Injectable()
export class OfferDetailsUsecase implements Usecase<OfferDetailsQuery, OfferDetailsResponse> {
  constructor(private readonly repository: OfferRepository) {}

  async execute({ id }: OfferDetailsQuery): Promise<OfferDetailsResponse> {
    const record = await this.repository.findById(id);
    if (record === undefined) {
      throw new ContentEntityNotFoundException();
    }
    return OfferDetailsResponse.of(record);
  }
}
