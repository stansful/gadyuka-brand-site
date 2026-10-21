import type { LocalizedText } from '~shared/contracts/common';

import { LocalizedTextValue, TranslationsInput } from '~core/locales/localized-text-value';

/** The fields of a review save request (controller → usecase). */
export interface ReviewSaveCommand {
  readonly author: string;
  readonly role: TranslationsInput;
  readonly text: TranslationsInput;
  readonly avatarId: string | null;
  readonly rating: number | null;
  readonly published: boolean;
}

/** A review as stored (empty translations dropped). */
export interface ReviewWrite {
  readonly author: string;
  readonly role: LocalizedText;
  readonly text: LocalizedText;
  readonly avatarId: string | null;
  readonly rating: number | null;
  readonly published: boolean;
}

export class ReviewWriteFactory {
  static fromCommand({ role, text, ...plain }: ReviewSaveCommand): ReviewWrite {
    return { ...plain, role: LocalizedTextValue.normalize(role), text: LocalizedTextValue.normalize(text) };
  }
}
