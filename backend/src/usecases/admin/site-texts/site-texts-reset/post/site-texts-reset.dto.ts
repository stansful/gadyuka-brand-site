import { ApiProperty } from '@nestjs/swagger';

import { IsString, MaxLength } from 'class-validator';

import type { SiteTextResetRequest } from '~shared/contracts/site-texts';

import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { ValidationMessage } from '~exception';

const MAX_KEY_LENGTH = 200;

/** Body of POST /admin/site-texts/reset. Anything but a site text key is «this text is no longer on the site». */
export class SiteTextsResetDto implements SiteTextResetRequest {
  @ApiProperty({ example: 'hero.title', maxLength: MAX_KEY_LENGTH })
  @MaxLength(MAX_KEY_LENGTH, ValidationMessage.of(SiteTextsMessageKey.ERRORS_UNKNOWN_KEY))
  @IsString(ValidationMessage.of(SiteTextsMessageKey.ERRORS_UNKNOWN_KEY))
  key: string;
}
