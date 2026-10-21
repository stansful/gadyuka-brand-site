import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { SocialDefaultLabelsResponse } from './social-default-labels.response';
import { SOCIAL_DEFAULT_LABELS_ROUTE } from './social-default-labels.route';
import { SocialDefaultLabelsUsecase } from './social-default-labels.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SocialDefaultLabelsController {
  constructor(private readonly usecase: SocialDefaultLabelsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Названия соцсетей по умолчанию',
    description: 'Тексты сайта social.<TYPE> по языкам — подпись ссылки без собственного названия.',
  })
  @ApiOkResponse({ type: SocialDefaultLabelsResponse })
  @Get(SOCIAL_DEFAULT_LABELS_ROUTE)
  async execute(): Promise<SocialDefaultLabelsResponse> {
    return this.usecase.execute();
  }
}
