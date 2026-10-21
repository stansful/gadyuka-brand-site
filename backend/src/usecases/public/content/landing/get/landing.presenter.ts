import { Injectable } from '@nestjs/common';

import type { IsoDateTime } from '~shared/contracts/common';
import type { LandingResponse as LandingResponseContract } from '~shared/contracts/content';

import { Locale } from '~core/locales/locale.enum';
import { OfferExpiry } from '~core/public-content/offer-expiry';
import { ReviewRatingScale } from '~core/reviews/review-rating-scale';
import { PublicCollectionPresenter } from '~usecases/public/content/common/public-collection.presenter';
import { PublicSettingsPresenter } from '~usecases/public/content/common/public-settings.presenter';

import { LandingFramePresenter } from './landing-frame.presenter';
import { LandingRows } from './landing-rows.loader';
import { LandingSectionsPresenter } from './landing-sections.presenter';
import { LandingFrameRows, LandingSectionRows, OfferRow } from './landing.repository';
import { LandingResponse } from './landing.response';

type LandingFrame = Pick<LandingResponseContract, 'images' | 'menu' | 'socials'>;
type LandingSections = Pick<LandingResponseContract, 'reviews' | 'news' | 'gallery' | 'offers' | 'partners'>;

/** The landing's rows → the localized answer (port of the frontend's getLanding mapping). */
@Injectable()
export class LandingPresenter {
  constructor(
    private readonly frame: LandingFramePresenter,
    private readonly sections: LandingSectionsPresenter,
    private readonly collections: PublicCollectionPresenter,
    private readonly settings: PublicSettingsPresenter,
  ) {}

  /** `now`: the moment the offers were read at (their expiry hint is counted from it). */
  toResponse(rows: LandingRows, locale: Locale, now: Date): LandingResponse {
    const settings = this.settings.toSettings(rows.settings, locale);
    return LandingResponse.of({
      locale,
      texts: rows.texts,
      collections: rows.collections.map(row => this.collections.toCollection(row, locale)),
      settings,
      offersExpireAt: this.toOffersExpireAt(rows.sections.offers, now),
      ...this.toFrame(rows.frame, locale),
      ...this.toSections(rows.sections, ReviewRatingScale.of(settings.reviewRatingMax), locale),
    });
  }

  private toFrame(rows: LandingFrameRows, locale: Locale): LandingFrame {
    return {
      images: this.frame.toImages(rows.images, locale),
      menu: this.frame.toMenu(rows.menu, locale),
      socials: this.frame.toSocials(rows.socials, locale),
    };
  }

  private toSections(rows: LandingSectionRows, scale: ReviewRatingScale, locale: Locale): LandingSections {
    return {
      reviews: this.sections.toReviews(rows.reviews, scale, locale),
      news: this.sections.toNews(rows.news, locale),
      gallery: this.sections.toGallery(rows.gallery, locale),
      offers: this.sections.toOffers(rows.offers, locale),
      partners: this.sections.toPartners(rows.partners, locale),
    };
  }

  private toOffersExpireAt(offers: readonly OfferRow[], now: Date): IsoDateTime | null {
    const earliest = OfferExpiry.findEarliest(
      offers.map(offer => offer.validUntil),
      now,
    );
    return earliest === null ? null : earliest.toISOString();
  }
}
