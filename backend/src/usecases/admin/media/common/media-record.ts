import type { LocalizedText } from '~shared/contracts/common';

/** A file of the media library as the admin sees it (list item, details, upload answer). */
export interface MediaRecord {
  readonly id: string;
  /** Public link of the file ("/media/<key>") */
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly alt: LocalizedText;
  readonly mime: string;
  /** Bytes */
  readonly size: number;
  readonly originalName: string | null;
  readonly createdAt: Date;
  /** Number of places that reference the file */
  readonly usageCount: number;
}
