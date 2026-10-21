import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '~decorator';
import { RefreshTokenDto } from '~usecases/auth/common/refresh-token.dto';

import { LOGOUT_ROUTE } from './logout.route';
import { LogoutUsecase } from './logout.usecase';

@Controller()
export class LogoutController {
  constructor(private readonly usecase: LogoutUsecase) {}

  @ApiTags('auth')
  @ApiOperation({ summary: 'Выход', description: 'Завершает сессию refresh-токена (и все её access-токены).' })
  @ApiNoContentResponse({ description: 'Сессия завершена (или токен уже недействителен)' })
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(LOGOUT_ROUTE)
  async execute(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.usecase.execute({ refreshToken: dto.refreshToken });
  }
}
