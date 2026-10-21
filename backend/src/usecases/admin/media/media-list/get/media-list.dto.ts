import { ApiPropertyOptional } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from 'class-validator';

import type { MediaListRequest } from '~shared/contracts/media';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { MediaMessageKey } from '~core/constants/media-message-key.enum';
import { MAX_MEDIA_SEARCH_LENGTH } from '~core/media/media-library.constants';
import { ValidationMessage } from '~exception';

/** Query of GET /admin/media. An empty cursor or search counts as none. */
export class MediaListDto implements MediaListRequest {
  @ApiPropertyOptional({ format: 'uuid', description: '`nextCursor` of the previous page' })
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsUUID('all', ValidationMessage.of(MediaMessageKey.BAD_CURSOR))
  cursor?: string;

  @ApiPropertyOptional({
    description: `Search in the original file name (case-insensitive; trimmed, the first ${MAX_MEDIA_SEARCH_LENGTH} characters)`,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().slice(0, MAX_MEDIA_SEARCH_LENGTH) : value,
  )
  @IsOptional()
  @IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID))
  q?: string;
}
