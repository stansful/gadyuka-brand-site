import { ApiProperty } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';
import type { PublicOffer } from '~shared/contracts/content';

import { PublicImageView } from '~usecases/public/content/common/views/public-image.view';

/** Swagger schema of a published, not expired offer (shared/contracts/content.ts). */
export class PublicOfferView implements PublicOffer {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  text: string;

  @ApiProperty({ description: '"" = no badge' })
  badge: string;

  @ApiProperty({ description: '"" = no button' })
  ctaLabel: string;

  @ApiProperty({ type: String, nullable: true })
  ctaHref: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'ISO 8601; null = no end date' })
  validUntil: string | null;

  @ApiProperty({ type: () => PublicImageView, nullable: true })
  image: ImageRef | null;
}
