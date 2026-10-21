import { Injectable } from '@nestjs/common';

import { Usecase } from '~usecases/usecase.interfaces';

import { DashboardNewLeadsRepository } from './dashboard-new-leads.repository';
import { DashboardNewLeadsResponse } from './dashboard-new-leads.response';

/** The new-leads badge of the admin sidebar (every admin page asks for it). */
@Injectable()
export class DashboardNewLeadsUsecase implements Usecase<void, DashboardNewLeadsResponse> {
  constructor(private readonly repository: DashboardNewLeadsRepository) {}

  async execute(): Promise<DashboardNewLeadsResponse> {
    return DashboardNewLeadsResponse.of(await this.repository.countNewLeads());
  }
}
