import type { LocalizedText } from '~shared/contracts/common';

import { LocalizedTextValue, TranslationsInput } from '~core/locales/localized-text-value';

/** The fields of a collection save request (controller → usecase). */
export interface CollectionSaveCommand {
  readonly slug: string;
  readonly title: TranslationsInput;
  readonly description: TranslationsInput;
  readonly coverId: string | null;
  readonly published: boolean;
}

/** A collection as stored (empty translations dropped). */
export interface CollectionWrite {
  readonly slug: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly coverId: string | null;
  readonly published: boolean;
}

export class CollectionWriteFactory {
  static fromCommand({ slug, title, description, coverId, published }: CollectionSaveCommand): CollectionWrite {
    return {
      slug,
      title: LocalizedTextValue.normalize(title),
      description: LocalizedTextValue.normalize(description),
      coverId,
      published,
    };
  }
}
