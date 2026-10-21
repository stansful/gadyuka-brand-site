import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, MaxLength } from 'class-validator';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { MAX_MEDIA_ALT_LENGTH } from '~core/media/media-library.constants';
import { ValidationMessage } from '~exception';
import { TextValidators } from '~usecases/admin/common/fields/text-validators';

const TOO_LONG = ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: MAX_MEDIA_ALT_LENGTH });
const RAW_MAX = LocalizedTextValue.MAX_TRANSLATION_LENGTH;
const TOO_LONG_RAW = ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: RAW_MAX });
const INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);

/**
 * The alt text per locale: at most 300 characters each once trimmed; empty = not translated.
 * class-validator checks a property's decorators bottom-up and stops at the first failure: the
 * type first, then the raw length, then the trimmed length.
 */
export class MediaAltTextDto {
  @ApiPropertyOptional({ maxLength: MAX_MEDIA_ALT_LENGTH, example: 'Белое худи с гравюрной змеёй' })
  @IsOptional()
  @TextValidators.maxTrimmedLength(MAX_MEDIA_ALT_LENGTH, TOO_LONG)
  @MaxLength(RAW_MAX, TOO_LONG_RAW)
  @IsString(INVALID)
  ru?: string;

  @ApiPropertyOptional({ maxLength: MAX_MEDIA_ALT_LENGTH, example: 'White hoodie with an engraved snake' })
  @IsOptional()
  @TextValidators.maxTrimmedLength(MAX_MEDIA_ALT_LENGTH, TOO_LONG)
  @MaxLength(RAW_MAX, TOO_LONG_RAW)
  @IsString(INVALID)
  en?: string;
}
