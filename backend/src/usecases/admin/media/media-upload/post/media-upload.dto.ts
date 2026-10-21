import { ApiProperty } from '@nestjs/swagger';

import { ACCEPTED_FORMATS_LABEL } from '~core/media/accepted-image-mime.enum';
import { MAX_UPLOAD_MEGABYTES } from '~core/media/media.constants';

/**
 * Swagger schema of the multipart body of POST /admin/media. Not a validated body: FileInterceptor
 * reads the file (field `file`), the image pipeline checks its bytes.
 */
export class MediaUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: `One image: ${ACCEPTED_FORMATS_LABEL}, at most ${MAX_UPLOAD_MEGABYTES} MB`,
  })
  file: unknown;
}
