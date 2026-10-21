import { Injectable, Logger } from '@nestjs/common';

import { EntityKind } from '~core/entities/entity-kind.enum';
import { EntityNotFoundException } from '~usecases/admin/entities/common/entity-not-found.exception';
import { EntityRowsRegistry } from '~usecases/admin/entities/common/entity-rows.registry';
import { Usecase } from '~usecases/usecase.interfaces';

export interface EntityDeleteCommand {
  readonly kind: EntityKind;
  readonly id: string;
}

/**
 * Deletes one row. Media files stay in the media library; a collection goes together with its
 * products (ON DELETE CASCADE). A row other rows still reference → 409 related (ApiExceptionFilter).
 */
@Injectable()
export class EntityDeleteUsecase implements Usecase<EntityDeleteCommand, void> {
  private readonly logger = new Logger(EntityDeleteUsecase.name);

  constructor(private readonly registry: EntityRowsRegistry) {}

  async execute({ kind, id }: EntityDeleteCommand): Promise<void> {
    const deleted = await this.registry.publishableRowsOf(kind).delete(id);
    if (deleted === 0) {
      throw new EntityNotFoundException();
    }
    this.logger.log('EntityDeleteUsecase : deleted', { kind, id });
  }
}
