import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsObject, ValidateIf, ValidateNested } from 'class-validator';

import type { SiteTextValueChange } from '~shared/contracts/site-texts';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { Locale } from '~core/locales/locale.enum';
import { ValidationMessage } from '~exception';

import { SiteTextValueChangeDto } from './site-text-value-change.dto';

const INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);

/** The languages of a text in the save: a missing language is left untouched, null is refused. */
export class SiteTextValuesDto implements Partial<Record<Locale, SiteTextValueChange>> {
  @ApiPropertyOptional({ type: () => SiteTextValueChangeDto })
  @ValidateNested()
  @Type(() => SiteTextValueChangeDto)
  @IsObject(INVALID)
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  [Locale.RU]?: SiteTextValueChangeDto;

  @ApiPropertyOptional({ type: () => SiteTextValueChangeDto })
  @ValidateNested()
  @Type(() => SiteTextValueChangeDto)
  @IsObject(INVALID)
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  [Locale.EN]?: SiteTextValueChangeDto;
}
