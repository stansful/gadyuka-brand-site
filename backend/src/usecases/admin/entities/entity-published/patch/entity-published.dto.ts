import { ApiProperty } from '@nestjs/swagger';

import { IsBoolean } from 'class-validator';

import type { EntityPublishedRequest } from '~shared/contracts/entities';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';

/** Body of PATCH /admin/entities/:kind/:id/published. */
export class EntityPublishedDto implements EntityPublishedRequest {
  @ApiProperty({ description: 'Show on the site (true) or hide (false)' })
  @IsBoolean(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  published: boolean;
}
