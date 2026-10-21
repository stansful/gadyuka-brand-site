import { Injectable } from '@nestjs/common';

import type { PublicCollection, PublicProduct } from '~shared/contracts/content';

import { Locale } from '~core/locales/locale.enum';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { TextLines } from '~core/public-content/text-lines';

import { PublicImagePresenter } from './public-image.presenter';
import { PublicCollectionRow, PublicProductRow } from './published-collections.repository';

/** Collection rows → the localized collections of the site (port of the frontend's toCollectionView). */
@Injectable()
export class PublicCollectionPresenter {
  constructor(private readonly images: PublicImagePresenter) {}

  toCollection(row: PublicCollectionRow, locale: Locale): PublicCollection {
    return {
      id: row.id,
      slug: row.slug,
      title: LocalizedTextValue.from(row.title).read(locale),
      description: LocalizedTextValue.from(row.description).read(locale),
      cover: this.images.toOptionalImage(row.cover, locale),
      products: row.products.map(product => this.toProduct(product, locale)),
    };
  }

  private toProduct(row: PublicProductRow, locale: Locale): PublicProduct {
    return {
      id: row.id,
      slug: row.slug,
      title: LocalizedTextValue.from(row.title).read(locale),
      description: LocalizedTextValue.from(row.description).read(locale),
      details: TextLines.split(LocalizedTextValue.from(row.details).read(locale)),
      price: row.price,
      images: row.images.map(image => this.images.toImage(image.media, locale)),
    };
  }
}
