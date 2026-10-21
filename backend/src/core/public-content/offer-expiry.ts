/**
 * When the visible offers change by themselves: nothing writes a row when an offer's validUntil
 * passes, so a cache of the landing must not outlive the earliest upcoming end.
 */
export class OfferExpiry {
  /** The earliest `validUntil` that is not in the past; null when none of them ends. */
  static findEarliest(validUntils: ReadonlyArray<Date | null>, now: Date): Date | null {
    const upcoming = validUntils
      .filter((validUntil): validUntil is Date => validUntil !== null)
      .map(validUntil => validUntil.getTime())
      .filter(time => time >= now.getTime());
    return upcoming.length === 0 ? null : new Date(Math.min(...upcoming));
  }
}
