import { ApiProperty } from '@nestjs/swagger';

import type { LeadTelegramStatusResponse as LeadTelegramStatusResponseContract } from '~shared/contracts/leads';

/** Answer of GET /admin/leads/telegram/status. */
export class LeadTelegramStatusResponse implements LeadTelegramStatusResponseContract {
  @ApiProperty({ description: 'TELEGRAM_DRY_RUN: leads are stored, nothing is sent to Telegram' })
  dryRun: boolean;

  static of({ dryRun }: LeadTelegramStatusResponseContract): LeadTelegramStatusResponse {
    return Object.assign(new LeadTelegramStatusResponse(), { dryRun });
  }
}
