import { ApiProperty } from '@nestjs/swagger';

import type { ImageRef } from '~shared/contracts/common';
import type { PublicPartner } from '~shared/contracts/content';

import { PublicImageView } from '~usecases/public/content/common/views/public-image.view';

/** Swagger schema of a published partner (shared/contracts/content.ts). */
export class PublicPartnerView implements PublicPartner {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  url: string | null;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: () => PublicImageView, nullable: true })
  logo: ImageRef | null;
}
