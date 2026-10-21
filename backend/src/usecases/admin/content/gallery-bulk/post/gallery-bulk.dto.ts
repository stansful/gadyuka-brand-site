import { ApiProperty } from '@nestjs/swagger';

import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, IsUUID, MinLength } from 'class-validator';

import type { AdminGalleryBulkInput } from '~shared/contracts/content-entities';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ContentEntitiesMessageKey } from '~core/constants/content-entities-message-key.enum';
import { GALLERY_LIMITS } from '~core/content-entities/content-limits.constants';
import { ValidationMessage } from '~exception';
import { ContentField } from '~usecases/admin/content/common/validation/content-field';

const { BULK_MIN_ITEMS, BULK_MAX_ITEMS } = GALLERY_LIMITS;

/** Body of POST /admin/gallery/bulk (port of the admin's bulkGallerySchema). */
export class GalleryBulkDto implements AdminGalleryBulkInput {
  // class-validator runs these bottom-up (the pipe stops at the first failure): the list, its size,
  // each id, then repeats.
  @ApiProperty({ type: [String], format: 'uuid', minItems: BULK_MIN_ITEMS, maxItems: BULK_MAX_ITEMS })
  @ArrayUnique(ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_PHOTOS_DUPLICATE))
  @IsUUID('all', { each: true, ...ValidationMessage.of(AdminMessageKey.VALIDATION_ID_INVALID) })
  @MinLength(1, { each: true, ...ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_ID_REQUIRED) })
  @IsString({ each: true, ...ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_ID_REQUIRED) })
  @ArrayMaxSize(
    BULK_MAX_ITEMS,
    ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_PHOTOS_BULK_TOO_MANY, { max: BULK_MAX_ITEMS }),
  )
  @ArrayMinSize(
    BULK_MIN_ITEMS,
    ValidationMessage.of(ContentEntitiesMessageKey.VALIDATION_PHOTOS_REQUIRED, { min: BULK_MIN_ITEMS }),
  )
  @IsArray(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  mediaIds: string[];

  @ContentField.flag('Shown on the site')
  published: boolean;
}
