import { ApiProperty } from '@nestjs/swagger';

import { IsIn, IsUUID } from 'class-validator';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { EntityKind } from '~core/entities/entity-kind.enum';
import { EntityKinds } from '~core/entities/entity-kinds';
import { ValidationMessage } from '~exception';

/** Path parameters :kind/:id of the publish toggle and the delete. */
export class EntityParamsDto {
  @ApiProperty({ enum: EntityKinds.PUBLISHABLE, example: EntityKind.COLLECTION })
  @IsIn(EntityKinds.PUBLISHABLE, ValidationMessage.of(AdminMessageKey.ERRORS_INVALID_REQUEST))
  kind: EntityKind;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', ValidationMessage.of(AdminMessageKey.VALIDATION_ID_INVALID))
  id: string;
}
