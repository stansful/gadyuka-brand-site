import { ApiProperty } from '@nestjs/swagger';

import type { EntityPublishedResponse as EntityPublishedResponseContract } from '~shared/contracts/entities';

import { PublishedChange } from '~usecases/admin/entities/common/entity-rows.interfaces';

/** Answer of PATCH /admin/entities/:kind/:id/published: the stored flag. */
export class EntityPublishedResponse implements EntityPublishedResponseContract {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  published: boolean;

  static of({ id, published }: PublishedChange): EntityPublishedResponse {
    return Object.assign(new EntityPublishedResponse(), { id, published });
  }
}
