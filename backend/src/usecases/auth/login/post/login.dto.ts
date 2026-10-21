import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import type { AuthLoginRequest } from '~shared/contracts/auth';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { ValidationMessage } from '~exception';

const MAX_LOGIN_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 256;

export class LoginDto implements AuthLoginRequest {
  @ApiProperty({ example: 'admin', maxLength: MAX_LOGIN_LENGTH, description: 'Case-insensitive' })
  @IsString(ValidationMessage.of(AdminMessageKey.AUTH_LOGIN_REQUIRED))
  @IsNotEmpty(ValidationMessage.of(AdminMessageKey.AUTH_LOGIN_REQUIRED))
  @MaxLength(MAX_LOGIN_LENGTH, ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: MAX_LOGIN_LENGTH }))
  login: string;

  @ApiProperty({ format: 'password', maxLength: MAX_PASSWORD_LENGTH })
  @IsString(ValidationMessage.of(AdminMessageKey.AUTH_PASSWORD_REQUIRED))
  @IsNotEmpty(ValidationMessage.of(AdminMessageKey.AUTH_PASSWORD_REQUIRED))
  @MaxLength(
    MAX_PASSWORD_LENGTH,
    ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max: MAX_PASSWORD_LENGTH }),
  )
  password: string;
}
