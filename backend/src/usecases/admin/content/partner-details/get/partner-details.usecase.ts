import { Injectable } from '@nestjs/common';

import { ContentEntityNotFoundException } from '~usecases/admin/content/common/exceptions/content-entity-not-found.exception';
import { PartnerDetailsResponse } from '~usecases/admin/content/common/partners/partner-details.response';
import { PartnerRepository } from '~usecases/admin/content/common/partners/partner.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface PartnerDetailsQuery {
  readonly id: string;
}

/** One partner for the edit form. */
@Injectable()
export class PartnerDetailsUsecase implements Usecase<PartnerDetailsQuery, PartnerDetailsResponse> {
  constructor(private readonly repository: PartnerRepository) {}

  async execute({ id }: PartnerDetailsQuery): Promise<PartnerDetailsResponse> {
    const record = await this.repository.findById(id);
    if (record === undefined) {
      throw new ContentEntityNotFoundException();
    }
    return PartnerDetailsResponse.of(record);
  }
}
