import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, ValidateNested } from 'class-validator';

import type { SiteTextsSaveRequest } from '~shared/contracts/site-texts';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { ValidationMessage } from '~exception';

import { SiteImageChangeDto } from './site-image-change.dto';
import { SiteTextChangeDto } from './site-text-change.dto';

/** A save sends the changed texts of one section, or of every match of a search. */
const MAX_TEXTS = 500;
const MAX_IMAGES = 20;
const INVALID = ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID);

/**
 * Body of PUT /admin/site-texts: the texts the editor changed (each language with the stored text it
 * started from) and the landing images the owner picked. class-validator runs the decorators of a
 * property bottom-up and the pipe stops at the first failure: the shape of a list first, then its size,
 * then repeated keys.
 */
export class SiteTextsSaveDto implements SiteTextsSaveRequest {
  @ApiProperty({ type: () => [SiteTextChangeDto], maxItems: MAX_TEXTS })
  @ValidateNested({ each: true })
  @Type(() => SiteTextChangeDto)
  @ArrayUnique(
    (entry: SiteTextChangeDto | null | undefined) => entry?.key,
    ValidationMessage.of(SiteTextsMessageKey.VALIDATION_TEXTS_DUPLICATE),
  )
  @ArrayMaxSize(MAX_TEXTS, ValidationMessage.of(SiteTextsMessageKey.VALIDATION_TOO_MANY_TEXTS))
  @IsArray(INVALID)
  entries: SiteTextChangeDto[];

  @ApiProperty({ type: () => [SiteImageChangeDto], maxItems: MAX_IMAGES })
  @ValidateNested({ each: true })
  @Type(() => SiteImageChangeDto)
  @ArrayUnique(
    (image: SiteImageChangeDto | null | undefined) => image?.key,
    ValidationMessage.of(SiteTextsMessageKey.VALIDATION_IMAGES_DUPLICATE),
  )
  @ArrayMaxSize(MAX_IMAGES, INVALID)
  @IsArray(INVALID)
  images: SiteImageChangeDto[];
}
