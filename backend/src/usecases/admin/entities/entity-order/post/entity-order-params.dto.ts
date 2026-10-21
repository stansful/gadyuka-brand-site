import { ApiProperty } from '@nestjs/swagger';

import { IsIn } from 'class-validator';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { EntityKind, OrderableEntityKind } from '~core/entities/entity-kind.enum';
import { EntityKinds } from '~core/entities/entity-kinds';
import { ValidationMessage } from '~exception';

/** Path parameter :kind of POST /admin/entities/:kind/reorder (news have no manual order). */
export class EntityOrderParamsDto {
  @ApiProperty({ enum: EntityKinds.ORDERABLE, example: EntityKind.PRODUCT })
  @IsIn(EntityKinds.ORDERABLE, ValidationMessage.of(AdminMessageKey.ERRORS_INVALID_REQUEST))
  kind: OrderableEntityKind;
}
