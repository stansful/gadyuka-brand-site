import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { MenuLinkTargetsResponse } from './menu-link-targets.response';
import { MENU_LINK_TARGETS_ROUTE } from './menu-link-targets.route';
import { MenuLinkTargetsUsecase } from './menu-link-targets.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MenuLinkTargetsController {
  constructor(private readonly usecase: MenuLinkTargetsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Ссылки для меню',
    description: 'Страницы коллекций (все, в порядке каталога) для выбора ссылки пункта меню.',
  })
  @ApiOkResponse({ type: MenuLinkTargetsResponse })
  @Get(MENU_LINK_TARGETS_ROUTE)
  async execute(): Promise<MenuLinkTargetsResponse> {
    return this.usecase.execute();
  }
}
