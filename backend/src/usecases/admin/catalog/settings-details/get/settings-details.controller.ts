import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { SettingsDetailsResponse } from './settings-details.response';
import { SETTINGS_DETAILS_ROUTE } from './settings-details.route';
import { SettingsDetailsUsecase } from './settings-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SettingsDetailsController {
  constructor(private readonly usecase: SettingsDetailsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Настройки', description: 'Контакты, шкала оценки отзывов, SEO и OG-картинка сайта.' })
  @ApiOkResponse({ type: SettingsDetailsResponse })
  @Get(SETTINGS_DETAILS_ROUTE)
  async execute(): Promise<SettingsDetailsResponse> {
    return this.usecase.execute();
  }
}
