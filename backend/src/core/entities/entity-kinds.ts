import { EntityKind, OrderableEntityKind } from './entity-kind.enum';

/** The kinds each list operation accepts (validation of the :kind path parameter). */
export class EntityKinds {
  static readonly PUBLISHABLE: readonly EntityKind[] = Object.values(EntityKind);

  static readonly ORDERABLE: readonly OrderableEntityKind[] = Object.values(EntityKind).filter(
    (kind): kind is OrderableEntityKind => kind !== EntityKind.NEWS,
  );
}
