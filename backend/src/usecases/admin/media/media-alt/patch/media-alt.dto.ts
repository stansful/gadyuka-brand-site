import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsDefined, IsObject, ValidateNested } from 'class-validator';

import type { MediaAltRequest } from '~shared/contracts/media';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';

import { MediaAltTextDto } from './media-alt-text.dto';

const INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);

/** Body of PATCH /admin/media/:id/alt. */
export class MediaAltDto implements MediaAltRequest {
  @ApiProperty({ type: MediaAltTextDto })
  @IsDefined(ValidationMessage.of(AdminMessageKey.VALIDATION_REQUIRED))
  @IsObject(INVALID)
  @ValidateNested()
  @Type(() => MediaAltTextDto)
  alt: MediaAltTextDto;
}
