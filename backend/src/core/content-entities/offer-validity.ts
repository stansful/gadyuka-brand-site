/** How long a special offer is shown: through the last millisecond of `validUntil` (null = no end). */
export class OfferValidity {
  constructor(private readonly validUntil: Date | null) {}

  isExpiredAt(moment: Date): boolean {
    return this.validUntil !== null && this.validUntil.getTime() < moment.getTime();
  }
}
