import { ApiProperty } from '@nestjs/swagger';

import { IsString, Matches, MaxLength } from 'class-validator';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '~core/constants/slug.constants';
import { ValidationMessage } from '~exception';

/** Path parameters of GET /public/collections/:slug (a slug that cannot exist is refused early). */
export class PublicCollectionDto {
  @ApiProperty({ example: 'noir', maxLength: SLUG_MAX_LENGTH, pattern: SLUG_PATTERN.source })
  @IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  @MaxLength(SLUG_MAX_LENGTH, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: SLUG_MAX_LENGTH }))
  @Matches(SLUG_PATTERN, ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  slug: string;
}
