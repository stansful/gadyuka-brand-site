import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

import type { SiteTextValueChange } from '~shared/contracts/site-texts';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';
import { TrimmedText } from '~usecases/admin/site-texts/common/trimmed-text';

/** Max length of one site text in one language (Message.value). */
const MAX_TEXT_LENGTH = 10_000;
const INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);

/**
 * One language of a text: `value` is trimmed but NOT dropped when empty (an empty Russian text hides an
 * optional element, an empty translation shows the Russian text); `base` is compared as stored.
 */
export class SiteTextValueChangeDto implements SiteTextValueChange {
  @ApiProperty({ maxLength: MAX_TEXT_LENGTH, description: 'The text (trimmed)' })
  @Transform(({ value }) => TrimmedText.of(value), { toClassOnly: true })
  @MaxLength(MAX_TEXT_LENGTH, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: MAX_TEXT_LENGTH }))
  @IsString(INVALID)
  value: string;

  @ApiProperty({ maxLength: MAX_TEXT_LENGTH, description: 'The stored text the edit started from' })
  @MaxLength(MAX_TEXT_LENGTH, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: MAX_TEXT_LENGTH }))
  @IsString(INVALID)
  base: string;
}
