import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { CurrentUser } from '~decorator';
import { AuthenticatedUser } from '~module/auth-token';

import { MeResponse } from './me.response';
import { ME_ROUTE } from './me.route';
import { MeUsecase } from './me.usecase';

@Controller()
export class MeController {
  constructor(private readonly usecase: MeUsecase) {}

  @ApiTags('auth')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Текущий пользователь', description: 'Пользователь и сессия access-токена.' })
  @ApiOkResponse({ type: MeResponse })
  @ApiUnauthorizedResponse({ description: 'error: unauthorized | accessTokenInvalid' })
  @Get(ME_ROUTE)
  async execute(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.usecase.execute({ id: user.id, role: user.role, sessionId: user.sessionId });
  }
}
