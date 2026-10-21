import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

import type { SiteImageChangeRequest } from '~shared/contracts/site-texts';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';
import { TrimmedText } from '~usecases/admin/site-texts/common/trimmed-text';

const MAX_IMAGE_KEY_LENGTH = 100;
const INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);

/** One landing image of the save: the picked media and the stored one the edit started from. */
export class SiteImageChangeDto implements SiteImageChangeRequest {
  @ApiProperty({ example: 'about.image', maxLength: MAX_IMAGE_KEY_LENGTH })
  @Transform(({ value }) => TrimmedText.of(value), { toClassOnly: true })
  @MaxLength(
    MAX_IMAGE_KEY_LENGTH,
    ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: MAX_IMAGE_KEY_LENGTH }),
  )
  @MinLength(1, ValidationMessage.of(AdminMessageKey.VALIDATION_REQUIRED))
  @IsString(INVALID)
  key: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The picked media (null = none)' })
  @IsUUID('all', ValidationMessage.of(AdminMessageKey.VALIDATION_ID_INVALID))
  @ValidateIf((_object: object, value: unknown) => value !== null)
  mediaId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The stored media it replaced' })
  @IsUUID('all', ValidationMessage.of(AdminMessageKey.VALIDATION_ID_INVALID))
  @ValidateIf((_object: object, value: unknown) => value !== null)
  base: string | null;
}
