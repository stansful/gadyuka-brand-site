import { ApiProperty } from '@nestjs/swagger';

import { Transform, Type } from 'class-transformer';
import { IsObject, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

import type { SiteTextChangeRequest } from '~shared/contracts/site-texts';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { ValidationMessage } from '~exception';
import { TrimmedText } from '~usecases/admin/site-texts/common/trimmed-text';

import { SiteTextValuesDto } from './site-text-values.dto';

const MAX_KEY_LENGTH = 200;
const INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);

/** One changed text of the save: its key and the changed languages. */
export class SiteTextChangeDto implements SiteTextChangeRequest {
  @ApiProperty({ example: 'hero.title', maxLength: MAX_KEY_LENGTH })
  @Transform(({ value }) => TrimmedText.of(value), { toClassOnly: true })
  @MaxLength(MAX_KEY_LENGTH, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: MAX_KEY_LENGTH }))
  @MinLength(1, ValidationMessage.of(SiteTextsMessageKey.VALIDATION_KEY_REQUIRED))
  @IsString(INVALID)
  key: string;

  @ApiProperty({ type: () => SiteTextValuesDto })
  @ValidateNested()
  @Type(() => SiteTextValuesDto)
  @IsObject(INVALID)
  values: SiteTextValuesDto;
}
