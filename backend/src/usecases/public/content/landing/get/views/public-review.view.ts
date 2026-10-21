import { ApiProperty } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';
import type { PublicReview } from '~shared/contracts/content';

import { PublicImageView } from '~usecases/public/content/common/views/public-image.view';

/** Swagger schema of a published review (shared/contracts/content.ts). */
export class PublicReviewView implements PublicReview {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  author: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  text: string;

  @ApiProperty({ type: () => PublicImageView, nullable: true })
  avatar: ImageRef | null;

  @ApiProperty({ type: Number, nullable: true, description: '1..settings.reviewRatingMax (clamped); null = no rating' })
  rating: number | null;
}
