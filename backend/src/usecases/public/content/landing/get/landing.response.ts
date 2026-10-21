import { ApiProperty, getSchemaPath } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';
import type {
  LandingResponse as LandingResponseContract,
  PublicCollection,
  PublicGalleryItem,
  PublicMenuItem,
  PublicNewsItem,
  PublicOffer,
  PublicPartner,
  PublicReview,
  PublicSettings,
  PublicSocialLink,
} from '~shared/contracts/content';

import { Locale } from '~core/locales/locale.enum';
import { PublicCollectionView } from '~usecases/public/content/common/views/public-collection.view';
import { PublicImageView } from '~usecases/public/content/common/views/public-image.view';
import { PublicSettingsView } from '~usecases/public/content/common/views/public-settings.view';

import { PublicGalleryItemView } from './views/public-gallery-item.view';
import { PublicMenuItemView } from './views/public-menu-item.view';
import { PublicNewsItemView } from './views/public-news-item.view';
import { PublicOfferView } from './views/public-offer.view';
import { PublicPartnerView } from './views/public-partner.view';
import { PublicReviewView } from './views/public-review.view';
import { PublicSocialLinkView } from './views/public-social-link.view';

/** Answer of GET /public/landing/:locale: everything the landing renders, localized. */
export class LandingResponse implements LandingResponseContract {
  @ApiProperty({ enum: Locale })
  locale: Locale;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Every site message of the locale, flat ({ "hero.title": "…" }): admin edits over shared/messages',
  })
  texts: Record<string, string>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { allOf: [{ $ref: getSchemaPath(PublicImageView) }], nullable: true },
    description: 'Landing images by ContentImage key ("about.image"); a row without media is null',
  })
  images: Record<string, ImageRef | null>;

  @ApiProperty({ type: () => [PublicMenuItemView], description: 'Published, ordered (at most 30)' })
  menu: PublicMenuItem[];

  @ApiProperty({ type: () => [PublicSocialLinkView], description: 'Published, ordered (at most 20)' })
  socials: PublicSocialLink[];

  @ApiProperty({ type: () => [PublicCollectionView], description: 'Published, ordered (at most 20)' })
  collections: PublicCollection[];

  @ApiProperty({ type: () => [PublicReviewView], description: 'Published, ordered, newer first on ties (at most 30)' })
  reviews: PublicReview[];

  @ApiProperty({ type: () => [PublicNewsItemView], description: 'Published, newest first (at most 12)' })
  news: PublicNewsItem[];

  @ApiProperty({ type: () => [PublicGalleryItemView], description: 'Published, ordered (at most 60)' })
  gallery: PublicGalleryItem[];

  @ApiProperty({ type: () => [PublicOfferView], description: 'Published and not expired, ordered (at most 12)' })
  offers: PublicOffer[];

  @ApiProperty({ type: () => [PublicPartnerView], description: 'Published, ordered (at most 40)' })
  partners: PublicPartner[];

  @ApiProperty({ type: () => PublicSettingsView })
  settings: PublicSettings;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The earliest validUntil among the offers (null: none ends) — do not cache the answer beyond it',
  })
  offersExpireAt: string | null;

  static of(fields: LandingResponseContract): LandingResponse {
    return Object.assign(new LandingResponse(), fields);
  }
}
