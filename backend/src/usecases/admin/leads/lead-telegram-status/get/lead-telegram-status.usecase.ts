import { Injectable } from '@nestjs/common';

import { ConfigService } from '~config';
import { Usecase } from '~usecases/usecase.interfaces';

import { LeadTelegramStatusResponse } from './lead-telegram-status.response';

/** Whether lead notifications are switched off (TELEGRAM_DRY_RUN): the admin warns about it in production. */
@Injectable()
export class LeadTelegramStatusUsecase implements Usecase<void, LeadTelegramStatusResponse> {
  constructor(private readonly config: ConfigService) {}

  execute(): LeadTelegramStatusResponse {
    return LeadTelegramStatusResponse.of({ dryRun: this.config.getSafety('TELEGRAM_DRY_RUN') });
  }
}
