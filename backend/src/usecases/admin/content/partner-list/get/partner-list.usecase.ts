import { Injectable } from '@nestjs/common';

import { PartnerRepository } from '~usecases/admin/content/common/partners/partner.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { PartnerListResponse } from './partner-list.response';

/** The admin's partners (manual order). */
@Injectable()
export class PartnerListUsecase implements Usecase<void, PartnerListResponse> {
  constructor(private readonly repository: PartnerRepository) {}

  async execute(): Promise<PartnerListResponse> {
    return PartnerListResponse.of(await this.repository.findList());
  }
}
