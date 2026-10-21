import { ApiProperty } from '@nestjs/swagger';

import type { LeadResendResponse as LeadResendResponseContract } from '~shared/contracts/leads';

import { LeadDelivery } from '~module/lead-notification';

/** Answer of POST /admin/leads/:id/resend: the outcome of this attempt, as stored on the lead. */
export class LeadResendResponse implements LeadResendResponseContract {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Telegram accepted the message (a dry run is not a delivery)' })
  telegramSent: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why not delivered (owner-facing text of telegram.errors.*)',
  })
  telegramError: string | null;

  static of(id: string, { telegramSent, telegramError }: LeadDelivery): LeadResendResponse {
    return Object.assign(new LeadResendResponse(), { id, telegramSent, telegramError });
  }
}
