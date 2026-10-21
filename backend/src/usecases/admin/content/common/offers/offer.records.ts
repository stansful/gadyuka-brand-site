import type { LocalizedText, MediaRef } from '~shared/contracts/common';

/** What a special offer stores (create / update; the order is set on create only). */
export interface OfferFields {
  readonly title: LocalizedText;
  readonly text: LocalizedText;
  readonly badge: LocalizedText;
  readonly ctaLabel: LocalizedText;
  readonly ctaHref: string | null;
  /** The last millisecond of the last day (Moscow); null = no end */
  readonly validUntil: Date | null;
  readonly imageId: string | null;
  readonly published: boolean;
}

/** A row of the admin's offer list. */
export interface OfferListRecord {
  readonly id: string;
  readonly title: LocalizedText;
  readonly badge: LocalizedText;
  readonly validUntil: Date | null;
  readonly image: MediaRef | null;
  readonly published: boolean;
}

/** An offer in the edit form. */
export interface OfferRecord extends OfferListRecord {
  readonly text: LocalizedText;
  readonly ctaLabel: LocalizedText;
  readonly ctaHref: string | null;
}
