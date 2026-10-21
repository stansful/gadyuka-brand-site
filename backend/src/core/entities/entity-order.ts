/** Where a row may move: rows are ordered among the rows of the same scope (a product: its collection). */
export interface OrderScope {
  readonly id: string;
  readonly scope: string;
}

/**
 * A requested manual order of one admin list (`ids[i]` gets order i) checked against the rows
 * that exist: every row must exist, and all of them must belong to one list — the products of a
 * collection are ordered within their collection, never across collections.
 */
export class EntityOrder {
  constructor(
    private readonly ids: readonly string[],
    private readonly found: readonly OrderScope[],
  ) {}

  hasEveryRow(): boolean {
    const found = new Set(this.found.map(row => row.id));
    return this.ids.every(id => found.has(id));
  }

  isWithinOneScope(): boolean {
    return new Set(this.found.map(row => row.scope)).size <= 1;
  }
}
