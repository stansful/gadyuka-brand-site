import { Body, Controller, Param, Put } from '@nestjs/common';
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
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { MenuItemInputDto } from '~usecases/admin/content/common/menu/menu-item-input.dto';

import { MENU_ITEM_UPDATE_ROUTE } from './menu-item-update.route';
import { MenuItemUpdateUsecase } from './menu-item-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MenuItemUpdateController {
  constructor(private readonly usecase: MenuItemUpdateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Сохранить пункт меню', description: 'Форма редактирования пункта меню.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Put(MENU_ITEM_UPDATE_ROUTE)
  async execute(
    @Param('id', RowIdPipe) id: string,
    @Body() dto: MenuItemInputDto,
  ): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({
      id,
      label: dto.label,
      href: dto.href,
      showInHeader: dto.showInHeader,
      showInFooter: dto.showInFooter,
      published: dto.published,
    });
  }
}
