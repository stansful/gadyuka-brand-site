import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { MenuItemListResponse } from './menu-item-list.response';
import { MENU_ITEM_LIST_ROUTE } from './menu-item-list.route';
import { MenuItemListUsecase } from './menu-item-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MenuItemListController {
  constructor(private readonly usecase: MenuItemListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Меню', description: 'Все пункты меню сайта в порядке показа.' })
  @ApiOkResponse({ type: MenuItemListResponse })
  @Get(MENU_ITEM_LIST_ROUTE)
  async execute(): Promise<MenuItemListResponse> {
    return this.usecase.execute();
  }
}
