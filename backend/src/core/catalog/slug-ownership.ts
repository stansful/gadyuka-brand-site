/** Who holds a URL slug, and whether the row being saved may take it. */
export class SlugOwnership {
  /**
   * @param ownerId the row that holds the slug now (null = free)
   * @param savedId the row being saved (undefined = a new row)
   */
  constructor(
    private readonly ownerId: string | null,
    private readonly savedId?: string,
  ) {}

  isTakenByAnother(): boolean {
    return this.ownerId !== null && this.ownerId !== this.savedId;
  }
}
