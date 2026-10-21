import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Public, UserAgent } from '~decorator';
import { LoginThrottlerGuard } from '~guard';
import { AuthTokensResponse } from '~usecases/auth/common/auth-tokens.response';

import { LoginDto } from './login.dto';
import { LOGIN_ROUTE } from './login.route';
import { LoginUsecase } from './login.usecase';

@Controller()
export class LoginController {
  constructor(private readonly usecase: LoginUsecase) {}

  @ApiTags('auth')
  @ApiOperation({ summary: 'Вход в админку', description: 'Логин + пароль → access + refresh токены новой сессии.' })
  @ApiOkResponse({ type: AuthTokensResponse })
  @ApiBadRequestResponse({ description: 'error: validation (admin.auth.loginRequired, admin.auth.passwordRequired …)' })
  @ApiUnauthorizedResponse({ description: 'error: invalidCredentials' })
  @ApiTooManyRequestsResponse({ description: 'error: throttled, values: { minutes }' })
  @Public()
  @UseGuards(LoginThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post(LOGIN_ROUTE)
  async execute(@Body() dto: LoginDto, @UserAgent() userAgent: string | undefined): Promise<AuthTokensResponse> {
    return this.usecase.execute({ login: dto.login, password: dto.password, userAgent });
  }
}
