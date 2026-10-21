import { Injectable } from '@nestjs/common';

import type {
  PublicGalleryItem,
  PublicNewsItem,
  PublicOffer,
  PublicPartner,
  PublicReview,
} from '~shared/contracts/content';

import { Locale } from '~core/locales/locale.enum';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { ReviewRatingScale } from '~core/reviews/review-rating-scale';
import { PublicImagePresenter } from '~usecases/public/content/common/public-image.presenter';

import { GalleryItemRow, NewsItemRow, OfferRow, PartnerRow, ReviewRow } from './landing.repository';

/** The entity sections of the landing → localized views (port of the frontend's getLanding mapping). */
@Injectable()
export class LandingSectionsPresenter {
  constructor(private readonly images: PublicImagePresenter) {}

  /** Ratings are shown on the current star scale (`scale`). */
  toReviews(rows: readonly ReviewRow[], scale: ReviewRatingScale, locale: Locale): PublicReview[] {
    return rows.map(row => ({
      id: row.id,
      author: row.author,
      role: LocalizedTextValue.from(row.role).read(locale),
      text: LocalizedTextValue.from(row.text).read(locale),
      avatar: this.images.toOptionalImage(row.avatar, locale),
      rating: scale.place(row.rating),
    }));
  }

  toNews(rows: readonly NewsItemRow[], locale: Locale): PublicNewsItem[] {
    return rows.map(row => ({
      id: row.id,
      slug: row.slug,
      title: LocalizedTextValue.from(row.title).read(locale),
      excerpt: LocalizedTextValue.from(row.excerpt).read(locale),
      body: LocalizedTextValue.from(row.body).read(locale),
      date: row.date.toISOString(),
      image: this.images.toOptionalImage(row.image, locale),
    }));
  }

  /** A gallery row without its picture is left out (the relation is required: defensive only). */
  toGallery(rows: readonly GalleryItemRow[], locale: Locale): PublicGalleryItem[] {
    return rows.flatMap(row => {
      const caption = LocalizedTextValue.from(row.caption).read(locale);
      return row.media === null ? [] : [{ id: row.id, caption, image: this.images.toImage(row.media, locale) }];
    });
  }

  toOffers(rows: readonly OfferRow[], locale: Locale): PublicOffer[] {
    return rows.map(row => ({
      id: row.id,
      title: LocalizedTextValue.from(row.title).read(locale),
      text: LocalizedTextValue.from(row.text).read(locale),
      badge: LocalizedTextValue.from(row.badge).read(locale),
      ctaLabel: LocalizedTextValue.from(row.ctaLabel).read(locale),
      ctaHref: row.ctaHref,
      validUntil: row.validUntil === null ? null : row.validUntil.toISOString(),
      image: this.images.toOptionalImage(row.image, locale),
    }));
  }

  toPartners(rows: readonly PartnerRow[], locale: Locale): PublicPartner[] {
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      url: row.url,
      description: LocalizedTextValue.from(row.description).read(locale),
      logo: this.images.toOptionalImage(row.logo, locale),
    }));
  }
}
