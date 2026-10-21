import { ApiProperty } from '@nestjs/swagger';

import type { PublicSocialLink } from '~shared/contracts/content';

import { SocialType } from '~core/socials/social-type';

/** Swagger schema of a published social link (shared/contracts/content.ts). */
export class PublicSocialLinkView implements PublicSocialLink {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: SocialType })
  type: SocialType;

  @ApiProperty({ example: 'https://t.me/gadyuka' })
  url: string;

  @ApiProperty({ type: String, nullable: true, description: 'null = the site shows its default label (social.<type>)' })
  label: string | null;
}
