import { Injectable, Logger } from '@nestjs/common';

import { LeadTelegramDelivery } from '~module/lead-notification';
import { LeadNotFoundException } from '~usecases/admin/leads/common/lead-not-found.exception';
import { Usecase } from '~usecases/usecase.interfaces';

import { LeadResendRepository } from './lead-resend.repository';
import { LeadResendResponse } from './lead-resend.response';

export interface LeadResendCommand {
  readonly id: string;
}

/**
 * «Отправить в Telegram повторно»: sends the lead to the owner again (delivered ones too) and stores the
 * outcome on it. A failed delivery is an answer, not an error: `telegramSent` false with the reason.
 */
@Injectable()
export class LeadResendUsecase implements Usecase<LeadResendCommand, LeadResendResponse> {
  private readonly logger = new Logger(LeadResendUsecase.name);

  constructor(
    private readonly repository: LeadResendRepository,
    private readonly delivery: LeadTelegramDelivery,
  ) {}

  async execute({ id }: LeadResendCommand): Promise<LeadResendResponse> {
    const lead = await this.repository.findTelegramLead(id);
    if (lead === null) {
      throw new LeadNotFoundException();
    }
    const outcome = await this.delivery.deliver(lead);
    this.logger.log('LeadResendUsecase : lead re-sent', { lead_id: id, telegram_sent: outcome.telegramSent });
    return LeadResendResponse.of(id, outcome);
  }
}
