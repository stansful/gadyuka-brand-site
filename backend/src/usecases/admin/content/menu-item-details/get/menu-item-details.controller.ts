import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { RowIdPipe } from '~usecases/admin/common/row-id.pipe';
import { MenuItemDetailsResponse } from '~usecases/admin/content/common/menu/menu-item-details.response';

import { MENU_ITEM_DETAILS_ROUTE } from './menu-item-details.route';
import { MenuItemDetailsUsecase } from './menu-item-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MenuItemDetailsController {
  constructor(private readonly usecase: MenuItemDetailsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Пункт меню', description: 'Пункт меню для формы редактирования.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MenuItemDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Get(MENU_ITEM_DETAILS_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string): Promise<MenuItemDetailsResponse> {
    return this.usecase.execute({ id });
  }
}
