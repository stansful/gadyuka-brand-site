import { ApiProperty } from '@nestjs/swagger';

import type { LeadSubmitResponse } from '~shared/contracts/leads';

/** Answer of POST /public/leads: the stored lead's id (a decoy id of the same format for a honeypot hit). */
export class LeadSubmissionResponse implements LeadSubmitResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  static of(id: string): LeadSubmissionResponse {
    return Object.assign(new LeadSubmissionResponse(), { id });
  }
}
