/** A ContentImage row: a landing image key and its media (null = none picked). */
export interface StoredSiteImage {
  readonly key: string;
  readonly mediaId: string | null;
}

/** A landing image in the save: the picked media and the stored one it replaced (null = none). */
export interface SiteImageChange extends StoredSiteImage {
  readonly base: string | null;
}

export interface SiteImageSavePlan {
  /** Keys of the images replaced elsewhere since the editor loaded them */
  readonly conflicts: readonly string[];
  readonly writes: readonly StoredSiteImage[];
}

/**
 * The ContentImage writes of a «Тексты сайта» save (port of the frontend's planSiteImageSave): an image
 * left as it was is skipped; a picked image whose row now holds a third media (replaced in another tab
 * or session) is a conflict and nothing is written; otherwise the row is written when it changes.
 */
export class SiteImageSavePlanner {
  plan(changes: readonly SiteImageChange[], rows: readonly StoredSiteImage[]): SiteImageSavePlan {
    const rowsByKey = new Map(rows.map(row => [row.key, row]));
    const picked = changes.filter(change => change.mediaId !== change.base);
    const conflicts = picked.filter(change => this.isReplacedElsewhere(change, rowsByKey.get(change.key)));
    const writes = picked.filter(change => this.needsWrite(change, rowsByKey.get(change.key)));
    return {
      conflicts: conflicts.map(change => change.key),
      writes: conflicts.length > 0 ? [] : writes.map(change => ({ key: change.key, mediaId: change.mediaId })),
    };
  }

  private isReplacedElsewhere(change: SiteImageChange, row: StoredSiteImage | undefined): boolean {
    const current = row === undefined ? null : row.mediaId;
    return current !== change.base && current !== change.mediaId;
  }

  private needsWrite(change: SiteImageChange, row: StoredSiteImage | undefined): boolean {
    return row === undefined || row.mediaId !== change.mediaId;
  }
}
