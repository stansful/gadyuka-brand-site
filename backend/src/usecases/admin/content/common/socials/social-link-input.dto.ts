import { ApiProperty } from '@nestjs/swagger';

import { IsIn } from 'class-validator';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminSocialLinkInput } from '~shared/contracts/content-entities';

import { ContentEntitiesMessageKey } from '~core/constants/content-entities-message-key.enum';
import { SOCIAL_LINK_LIMITS } from '~core/content-entities/content-limits.constants';
import { SocialType } from '~core/socials/social-type';
import { ValidationMessage } from '~exception';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';

import { ContentField } from '../validation/content-field';

/** Body of POST /admin/social-links and PUT /admin/social-links/:id (port of the admin's socialLinkInputSchema). */
export class SocialLinkInputDto implements AdminSocialLinkInput {
  @ApiProperty({ enum: SocialType, enumName: 'SocialType' })
  @IsIn(Object.values(SocialType), ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_SOCIAL_TYPE))
  type: SocialType;

  @ContentField.httpUrl('Link to the profile or chat (https://…)')
  url: string;

  @LocalizedTextField.optional({ max: SOCIAL_LINK_LIMITS.LABEL, description: 'Own label; empty = the default name' })
  label: LocalizedText;

  @ContentField.flag('Shown on the site (contacts, search data)')
  published: boolean;
}
