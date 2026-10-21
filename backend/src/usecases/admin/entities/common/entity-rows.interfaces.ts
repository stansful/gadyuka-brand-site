import { OrderScope } from '~core/entities/entity-order';

/** New value of the `published` flag of one row. */
export interface PublishedChange {
  readonly id: string;
  readonly published: boolean;
}

/** Data access of an entity with a `published` flag (one implementation per entity: EntityRowsRegistry). */
export interface PublishableRows {
  /** Rows changed: 1, or 0 when there is no such row. */
  updatePublished(change: PublishedChange): Promise<number>;
  /** Rows deleted: 1, or 0 when there is no such row. Referenced media files stay. */
  delete(id: string): Promise<number>;
}

/** Data access of an entity with a manual `order`. */
export interface OrderableRows extends PublishableRows {
  /** The existing rows among `ids` with the scope they are ordered in. */
  findOrderScopes(ids: readonly string[]): Promise<OrderScope[]>;
  /** `ids[i]` gets order i, in one transaction (a row deleted meanwhile → 404 through the filter). */
  updateOrder(ids: readonly string[]): Promise<void>;
}
