import type { LocalizedText, MediaRef } from '~shared/contracts/common';

/** What a partner stores (create / update; the order is set on create only). */
export interface PartnerFields {
  readonly name: string;
  readonly url: string | null;
  readonly logoId: string | null;
  readonly description: LocalizedText;
  readonly published: boolean;
}

/** A partner (list rows and the edit form). */
export interface PartnerRecord {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly logo: MediaRef | null;
  readonly description: LocalizedText;
  readonly published: boolean;
}
