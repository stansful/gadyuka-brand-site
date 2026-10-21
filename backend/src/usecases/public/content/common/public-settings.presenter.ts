import { Injectable } from '@nestjs/common';

import type { PublicSettings } from '~shared/contracts/content';

import { Locale } from '~core/locales/locale.enum';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { ReviewRatingScale } from '~core/reviews/review-rating-scale';

import { PublicImagePresenter } from './public-image.presenter';
import { PublicSettingsRow } from './public-settings.repository';

/** The SiteSettings row → the localized settings of the site (port of the frontend's loadSettings). */
@Injectable()
export class PublicSettingsPresenter {
  /** What the site shows before the settings were saved once (= the column defaults). */
  private static readonly DEFAULTS: PublicSettings = {
    phone: '',
    email: '',
    address: '',
    reviewRatingMax: ReviewRatingScale.DEFAULT_MAX,
    seoTitle: '',
    seoDescription: '',
    ogImage: null,
  };

  constructor(private readonly images: PublicImagePresenter) {}

  toSettings(row: PublicSettingsRow | null, locale: Locale): PublicSettings {
    return row === null ? PublicSettingsPresenter.DEFAULTS : this.toSavedSettings(row, locale);
  }

  private toSavedSettings(row: PublicSettingsRow, locale: Locale): PublicSettings {
    return {
      phone: row.phone,
      email: row.email,
      address: LocalizedTextValue.from(row.address).read(locale),
      reviewRatingMax: row.reviewRatingMax,
      seoTitle: LocalizedTextValue.from(row.seoTitle).read(locale),
      seoDescription: LocalizedTextValue.from(row.seoDescription).read(locale),
      ogImage: this.images.toOptionalImage(row.ogImage, locale),
    };
  }
}
