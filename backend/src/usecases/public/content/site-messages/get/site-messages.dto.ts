import { ApiProperty } from '@nestjs/swagger';

import { IsIn } from 'class-validator';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { ValidationMessage } from '~exception';

/** Path parameters of GET /public/messages/:locale. */
export class SiteMessagesDto {
  @ApiProperty({ enum: Locale, example: Locale.RU })
  @IsIn(LocaleMap.LOCALES, ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  locale: Locale;
}
