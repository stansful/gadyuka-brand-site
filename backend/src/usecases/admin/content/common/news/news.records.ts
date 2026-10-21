import type { LocalizedText, MediaRef } from '~shared/contracts/common';

/** What a news item stores (create / update). `date` = noon Moscow time of the chosen day. */
export interface NewsFields {
  readonly slug: string;
  readonly title: LocalizedText;
  readonly excerpt: LocalizedText;
  readonly body: LocalizedText;
  readonly date: Date;
  readonly imageId: string | null;
  readonly published: boolean;
}

/** A row of the admin's news list. */
export interface NewsListRecord {
  readonly id: string;
  readonly slug: string;
  readonly title: LocalizedText;
  readonly date: Date;
  readonly image: MediaRef | null;
  readonly published: boolean;
}

/** A news item in the edit form. */
export interface NewsRecord extends NewsListRecord {
  readonly excerpt: LocalizedText;
  readonly body: LocalizedText;
}
