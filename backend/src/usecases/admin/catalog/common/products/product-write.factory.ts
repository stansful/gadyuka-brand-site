import type { LocalizedText } from '~shared/contracts/common';

import { LocalizedTextValue, TranslationsInput } from '~core/locales/localized-text-value';

/** The fields of a product save request (controller → usecase). */
export interface ProductSaveCommand {
  readonly slug: string;
  readonly collectionId: string;
  readonly title: TranslationsInput;
  readonly description: TranslationsInput;
  readonly details: TranslationsInput;
  readonly price: number | null;
  readonly imageIds: readonly string[];
  readonly published: boolean;
}

/** The product row as stored (empty translations dropped). */
export interface ProductFields {
  readonly slug: string;
  readonly collectionId: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly details: LocalizedText;
  readonly price: number | null;
  readonly published: boolean;
}

/** A product as written: its row and its photos in display order. */
export interface ProductWrite {
  readonly fields: ProductFields;
  readonly imageIds: readonly string[];
}

export class ProductWriteFactory {
  static fromCommand({ imageIds, ...command }: ProductSaveCommand): ProductWrite {
    return { fields: ProductWriteFactory.toFields(command), imageIds };
  }

  private static toFields(command: Omit<ProductSaveCommand, 'imageIds'>): ProductFields {
    const { title, description, details, ...plain } = command;
    return {
      ...plain,
      title: LocalizedTextValue.normalize(title),
      description: LocalizedTextValue.normalize(description),
      details: LocalizedTextValue.normalize(details),
    };
  }
}
