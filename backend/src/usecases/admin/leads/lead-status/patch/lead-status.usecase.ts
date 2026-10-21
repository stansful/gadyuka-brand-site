import { Injectable, Logger } from '@nestjs/common';

import { Usecase } from '~usecases/usecase.interfaces';

import { LeadStatusChange, LeadStatusRepository } from './lead-status.repository';
import { LeadStatusResponse } from './lead-status.response';

/** The admin moves a lead through its processing: NEW → IN_PROGRESS → DONE, or SPAM (any change allowed). */
@Injectable()
export class LeadStatusUsecase implements Usecase<LeadStatusChange, LeadStatusResponse> {
  private readonly logger = new Logger(LeadStatusUsecase.name);

  constructor(private readonly repository: LeadStatusRepository) {}

  async execute({ id, status }: LeadStatusChange): Promise<LeadStatusResponse> {
    const stored = await this.repository.updateStatus({ id, status });
    this.logger.log('LeadStatusUsecase : status changed', { lead_id: stored.id, status: stored.status });
    return LeadStatusResponse.of(stored);
  }
}
