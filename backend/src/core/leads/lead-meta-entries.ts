/** One entry of Lead.meta as the admin shows it. */
export interface LeadMetaEntry {
  readonly key: string;
  readonly value: string;
}

/**
 * Lead.meta (JSON) as a list for the admin's «Дополнительно»: an object's entries (at most 50) with
 * strings as is and anything else as JSON; another non-null value as one "meta" entry; null → none.
 */
export class LeadMetaEntries {
  private static readonly MAX_ENTRIES = 50;
  private static readonly WHOLE_VALUE_KEY = 'meta';

  static of(meta: unknown): LeadMetaEntry[] {
    if (meta === null || meta === undefined) {
      return [];
    }
    if (typeof meta !== 'object' || Array.isArray(meta)) {
      return [{ key: LeadMetaEntries.WHOLE_VALUE_KEY, value: JSON.stringify(meta) }];
    }
    return Object.entries(meta)
      .slice(0, LeadMetaEntries.MAX_ENTRIES)
      .map(([key, value]: [string, unknown]) => ({ key, value: LeadMetaEntries.textOf(value) }));
  }

  private static textOf(value: unknown): string {
    return typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  }
}
