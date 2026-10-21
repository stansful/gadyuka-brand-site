import { ApiProperty } from '@nestjs/swagger';

import { IsUUID } from 'class-validator';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';

/** Path parameter :id of /admin/leads/:id… */
export class LeadIdParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', ValidationMessage.of(AdminMessageKey.VALIDATION_ID_INVALID))
  id: string;
}
