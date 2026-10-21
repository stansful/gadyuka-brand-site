import { ApiProperty } from '@nestjs/swagger';

import type { AdminSiteSettingsResponse } from '~shared/contracts/catalog';
import type { LocalizedText } from '~shared/contracts/common';

import { ReviewRatingScale } from '~core/reviews/review-rating-scale';
import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

/** Answer of GET /admin/settings: contacts, the review star scale, SEO and the OG image. */
export class SettingsDetailsResponse implements AdminSiteSettingsResponse {
  @ApiProperty({ example: '+7 900 000-00-00' })
  phone: string;

  @ApiProperty({ example: 'hello@example.ru' })
  email: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' }, example: { ru: 'Краснодар' } })
  address: LocalizedText;

  @ApiProperty({ minimum: ReviewRatingScale.LIMIT.MIN, maximum: ReviewRatingScale.LIMIT.MAX })
  reviewRatingMax: number;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  seoTitle: LocalizedText;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  seoDescription: LocalizedText;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  ogImage: MediaRefResponse | null;

  static of(settings: AdminSiteSettingsResponse): SettingsDetailsResponse {
    return Object.assign(new SettingsDetailsResponse(), {
      ...settings,
      ogImage: MediaRefResponse.ofNullable(settings.ogImage),
    });
  }
}
