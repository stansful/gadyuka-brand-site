import { ApiProperty } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';
import type { PublicSettings } from '~shared/contracts/content';

import { ReviewRatingScale } from '~core/reviews/review-rating-scale';

import { PublicImageView } from './public-image.view';

/** Swagger schema of the site settings for one locale (shared/contracts/content.ts). */
export class PublicSettingsView implements PublicSettings {
  @ApiProperty({ example: '+7 900 000-00-00' })
  phone: string;

  @ApiProperty({ example: 'hello@example.com' })
  email: string;

  @ApiProperty()
  address: string;

  @ApiProperty({
    minimum: ReviewRatingScale.LIMIT.MIN,
    maximum: ReviewRatingScale.LIMIT.MAX,
    example: ReviewRatingScale.DEFAULT_MAX,
    description: 'Stars of the review rating scale',
  })
  reviewRatingMax: number;

  @ApiProperty()
  seoTitle: string;

  @ApiProperty()
  seoDescription: string;

  @ApiProperty({ type: () => PublicImageView, nullable: true })
  ogImage: ImageRef | null;
}
