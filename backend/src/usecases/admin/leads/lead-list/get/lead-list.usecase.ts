import { Injectable } from '@nestjs/common';

import { LeadListPage } from '~core/leads/lead-list-page';
import { Usecase } from '~usecases/usecase.interfaces';

import { LeadFilter, LeadListRepository } from './lead-list.repository';
import { LeadListResponse } from './lead-list.response';

export interface LeadListCommand extends LeadFilter {
  /** 1-based (default: the first page); clamped to the pages there are */
  readonly page: number | undefined;
}

/** The admin's leads list: filtered by type / status, 25 per page, newest first. */
@Injectable()
export class LeadListUsecase implements Usecase<LeadListCommand, LeadListResponse> {
  constructor(private readonly repository: LeadListRepository) {}

  async execute({ type, status, page }: LeadListCommand): Promise<LeadListResponse> {
    const total = await this.repository.countLeads({ type, status });
    const listPage = LeadListPage.of(page ?? LeadListPage.FIRST, total);
    const rows = await this.repository.findLeads({ type, status }, { offset: listPage.offset, limit: listPage.size });
    return LeadListResponse.of(rows, listPage, total);
  }
}
