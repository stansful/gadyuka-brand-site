import { ApiProperty } from '@nestjs/swagger';

import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

import type { EntityOrderRequest } from '~shared/contracts/entities';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { MAX_REORDER_IDS } from '~core/entities/entity-order.constants';
import { ValidationMessage } from '~exception';

/** Body of POST /admin/entities/:kind/reorder: the ids in their new order. */
export class EntityOrderDto implements EntityOrderRequest {
  // class-validator runs these bottom-up (and the pipe stops at the first failure): the shape of the
  // list first, then its ids, then repeats.
  @ApiProperty({ type: [String], format: 'uuid', minItems: 1, maxItems: MAX_REORDER_IDS })
  @ArrayUnique(ValidationMessage.of(AdminMessageKey.VALIDATION_LIST_DUPLICATE))
  @IsUUID('all', { each: true, ...ValidationMessage.of(AdminMessageKey.VALIDATION_ID_INVALID) })
  @ArrayMaxSize(MAX_REORDER_IDS, ValidationMessage.of(AdminMessageKey.ENTITIES_INVALID_ORDER))
  @ArrayMinSize(1, ValidationMessage.of(AdminMessageKey.ENTITIES_INVALID_ORDER))
  @IsArray(ValidationMessage.of(AdminMessageKey.ENTITIES_INVALID_ORDER))
  ids: string[];
}
