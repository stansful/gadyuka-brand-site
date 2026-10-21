import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminSocialLinkListItem } from '~shared/contracts/content-entities';

import { SocialProfileUrl } from '~core/content-entities/social-profile-url';
import { SocialType } from '~core/socials/social-type';
import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';
import { SocialLinkRecord } from '~usecases/admin/content/common/socials/social-link.records';

/** A row of the admin's social link list. */
export class SocialLinkListItemResponse implements AdminSocialLinkListItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: SocialType, enumName: 'SocialType' })
  type: SocialType;

  @ApiProperty()
  url: string;

  @ApiProperty(LocalizedTextSchema.of('Own label ({} = the default name of the type)'))
  label: LocalizedText;

  @ApiProperty({ description: 'A placeholder link without a profile ("https://t.me/")' })
  bareUrl: boolean;

  @ApiProperty()
  published: boolean;

  static of({ id, type, url, label, published }: SocialLinkRecord): SocialLinkListItemResponse {
    const bareUrl = SocialProfileUrl.isBare(url);
    return Object.assign(new SocialLinkListItemResponse(), { id, type, url, label, bareUrl, published });
  }
}
