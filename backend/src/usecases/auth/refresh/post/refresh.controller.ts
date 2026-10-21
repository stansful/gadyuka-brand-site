import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { Public } from '~decorator';
import { AuthTokensResponse } from '~usecases/auth/common/auth-tokens.response';
import { RefreshTokenDto } from '~usecases/auth/common/refresh-token.dto';

import { REFRESH_ROUTE } from './refresh.route';
import { RefreshUsecase } from './refresh.usecase';

@Controller()
export class RefreshController {
  constructor(private readonly usecase: RefreshUsecase) {}

  @ApiTags('auth')
  @ApiOperation({
    summary: 'Обновление сессии',
    description:
      'Refresh-токен → новая пара токенов. Старый refresh-токен больше не действует; повторное предъявление завершает сессию.',
  })
  @ApiOkResponse({ type: AuthTokensResponse })
  @ApiUnauthorizedResponse({ description: 'error: refreshTokenInvalid | refreshTokenReused' })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(REFRESH_ROUTE)
  async execute(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponse> {
    return this.usecase.execute({ refreshToken: dto.refreshToken });
  }
}
