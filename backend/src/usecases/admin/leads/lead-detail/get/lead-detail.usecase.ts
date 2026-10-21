import { Injectable } from '@nestjs/common';

import { LeadNotFoundException } from '~usecases/admin/leads/common/lead-not-found.exception';
import { Usecase } from '~usecases/usecase.interfaces';

import { LeadDetailRepository } from './lead-detail.repository';
import { LeadDetailResponse } from './lead-detail.response';

export interface LeadDetailCommand {
  readonly id: string;
}

/** One lead with its message, metadata and Telegram status. */
@Injectable()
export class LeadDetailUsecase implements Usecase<LeadDetailCommand, LeadDetailResponse> {
  constructor(private readonly repository: LeadDetailRepository) {}

  async execute({ id }: LeadDetailCommand): Promise<LeadDetailResponse> {
    const row = await this.repository.findLead(id);
    if (row === null) {
      throw new LeadNotFoundException();
    }
    return LeadDetailResponse.of(row);
  }
}
