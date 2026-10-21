/** Manual order of an admin list (`order` column, 0-based, ascending). */
export class ListPosition {
  private static readonly BEFORE_FIRST = -1;

  /** A new row goes last: after the highest order of its list (0 for an empty list). */
  static after(lastOrder: number | null): number {
    return (lastOrder ?? ListPosition.BEFORE_FIRST) + 1;
  }

  /**
   * A product keeps its position only within its collection: one moved to another collection goes
   * last there, like a new one.
   */
  static isKeptOnMove(currentCollectionId: string, targetCollectionId: string): boolean {
    return currentCollectionId === targetCollectionId;
  }
}
