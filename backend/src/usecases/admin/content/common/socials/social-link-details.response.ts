import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminSocialLinkDetails } from '~shared/contracts/content-entities';

import { SocialType } from '~core/socials/social-type';
import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';

import { SocialLinkRecord } from './social-link.records';

/** A social link in the edit form (GET /admin/social-links/:id). */
export class SocialLinkDetailsResponse implements AdminSocialLinkDetails {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: SocialType, enumName: 'SocialType' })
  type: SocialType;

  @ApiProperty()
  url: string;

  @ApiProperty(LocalizedTextSchema.of('Own label ({} = the default name of the type)'))
  label: LocalizedText;

  @ApiProperty()
  published: boolean;

  static of({ id, type, url, label, published }: SocialLinkRecord): SocialLinkDetailsResponse {
    return Object.assign(new SocialLinkDetailsResponse(), { id, type, url, label, published });
  }
}
