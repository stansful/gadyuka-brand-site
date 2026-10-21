import { Injectable, Logger } from '@nestjs/common';

import { OrderableEntityKind } from '~core/entities/entity-kind.enum';
import { EntityOrder } from '~core/entities/entity-order';
import { EntityNotFoundException } from '~usecases/admin/entities/common/entity-not-found.exception';
import { OrderableRows } from '~usecases/admin/entities/common/entity-rows.interfaces';
import { EntityRowsRegistry } from '~usecases/admin/entities/common/entity-rows.registry';
import { InvalidEntityOrderException } from '~usecases/admin/entities/common/invalid-entity-order.exception';
import { Usecase } from '~usecases/usecase.interfaces';

export interface EntityOrderCommand {
  readonly kind: OrderableEntityKind;
  readonly ids: readonly string[];
}

/**
 * Persists a drag & drop order: `ids[i]` gets order i. Every row must exist (404 otherwise) and
 * belong to one list — products are ordered within their collection (400 invalidOrder otherwise).
 */
@Injectable()
export class EntityOrderUsecase implements Usecase<EntityOrderCommand, void> {
  private readonly logger = new Logger(EntityOrderUsecase.name);

  constructor(private readonly registry: EntityRowsRegistry) {}

  async execute({ kind, ids }: EntityOrderCommand): Promise<void> {
    const rows = this.registry.orderableRowsOf(kind);
    await this.assertOrderable(rows, ids);
    await rows.updateOrder(ids);
    this.logger.log('EntityOrderUsecase : order saved', { kind, rows: ids.length });
  }

  private async assertOrderable(rows: OrderableRows, ids: readonly string[]): Promise<void> {
    const order = new EntityOrder(ids, await rows.findOrderScopes(ids));
    if (!order.hasEveryRow()) {
      throw new EntityNotFoundException();
    }
    if (!order.isWithinOneScope()) {
      throw new InvalidEntityOrderException();
    }
  }
}
