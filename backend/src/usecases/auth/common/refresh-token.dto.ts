import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import type { AuthRefreshRequest } from '~shared/contracts/auth';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';

const MAX_REFRESH_TOKEN_LENGTH = 512;

/** Body of POST /auth/refresh and POST /auth/logout. */
export class RefreshTokenDto implements AuthRefreshRequest {
  @ApiProperty({ description: 'The refresh token of the session', maxLength: MAX_REFRESH_TOKEN_LENGTH })
  @IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_REQUIRED))
  @IsNotEmpty(ValidationMessage.of(AdminMessageKey.VALIDATION_REQUIRED))
  @MaxLength(
    MAX_REFRESH_TOKEN_LENGTH,
    ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: MAX_REFRESH_TOKEN_LENGTH }),
  )
  refreshToken: string;
}
