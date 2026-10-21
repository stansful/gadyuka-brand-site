import { Injectable, Logger } from '@nestjs/common';

import { EntityKind } from '~core/entities/entity-kind.enum';
import { EntityNotFoundException } from '~usecases/admin/entities/common/entity-not-found.exception';
import { PublishedChange } from '~usecases/admin/entities/common/entity-rows.interfaces';
import { EntityRowsRegistry } from '~usecases/admin/entities/common/entity-rows.registry';
import { Usecase } from '~usecases/usecase.interfaces';

import { EntityPublishedResponse } from './entity-published.response';

export interface EntityPublishedCommand extends PublishedChange {
  readonly kind: EntityKind;
}

/** Shows a row on the site or hides it (collections … social links, news). */
@Injectable()
export class EntityPublishedUsecase implements Usecase<EntityPublishedCommand, EntityPublishedResponse> {
  private readonly logger = new Logger(EntityPublishedUsecase.name);

  constructor(private readonly registry: EntityRowsRegistry) {}

  async execute({ kind, id, published }: EntityPublishedCommand): Promise<EntityPublishedResponse> {
    const changed = await this.registry.publishableRowsOf(kind).updatePublished({ id, published });
    if (changed === 0) {
      throw new EntityNotFoundException();
    }
    this.logger.log('EntityPublishedUsecase : published flag changed', { kind, id, published });
    return EntityPublishedResponse.of({ id, published });
  }
}
