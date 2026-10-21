import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminPartnerInput } from '~shared/contracts/content-entities';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ContentEntitiesMessageKey } from '~core/constants/content-entities-message-key.enum';
import { PARTNER_LIMITS } from '~core/content-entities/content-limits.constants';
import { ValidationMessage } from '~exception';
import { LocalizedTextField } from '~usecases/admin/common/fields/localized-text.field';
import { TextTransform } from '~usecases/admin/common/fields/text.transform';

import { ContentField } from '../validation/content-field';

/** Body of POST /admin/partners and PUT /admin/partners/:id (port of the admin's partnerInputSchema). */
export class PartnerInputDto implements AdminPartnerInput {
  // Runs bottom-up after trimming: a string, not empty, not too long.
  @ApiProperty({ description: 'Name (the same in every language)', maxLength: PARTNER_LIMITS.NAME })
  @MaxLength(
    PARTNER_LIMITS.NAME,
    ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: PARTNER_LIMITS.NAME }),
  )
  @MinLength(1, ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_NAME_REQUIRED))
  @IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  @Transform(TextTransform.trim, { toClassOnly: true })
  name: string;

  @ContentField.optionalHttpUrl('Site of the partner (https://…) or null')
  url: string | null;

  @ContentField.optionalMediaId('Logo (media id) or null')
  logoId: string | null;

  @LocalizedTextField.optional({ max: PARTNER_LIMITS.DESCRIPTION, description: 'Description' })
  description: LocalizedText;

  @ContentField.flag('Shown on the site')
  published: boolean;
}
