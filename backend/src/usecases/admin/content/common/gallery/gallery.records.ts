import type { LocalizedText, MediaRef } from '~shared/contracts/common';

/** What a gallery item stores (create / update; the order is set on create only). */
export interface GalleryFields {
  readonly mediaId: string;
  readonly caption: LocalizedText;
  readonly published: boolean;
}

/** Photos appended to the gallery at once, in this order, without captions. */
export interface GalleryBulkRows {
  readonly mediaIds: readonly string[];
  readonly published: boolean;
  /** Order of the first photo */
  readonly firstOrder: number;
}

/** A gallery item (list rows and the edit form). */
export interface GalleryRecord {
  readonly id: string;
  readonly media: MediaRef;
  readonly caption: LocalizedText;
  readonly published: boolean;
}
