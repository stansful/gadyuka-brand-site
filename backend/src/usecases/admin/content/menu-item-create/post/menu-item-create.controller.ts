import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { MenuItemInputDto } from '~usecases/admin/content/common/menu/menu-item-input.dto';

import { MENU_ITEM_CREATE_ROUTE } from './menu-item-create.route';
import { MenuItemCreateUsecase } from './menu-item-create.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MenuItemCreateController {
  constructor(private readonly usecase: MenuItemCreateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новый пункт меню', description: 'Добавляет пункт в конец меню.' })
  @ApiCreatedResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation' })
  @Post(MENU_ITEM_CREATE_ROUTE)
  async execute(@Body() dto: MenuItemInputDto): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({
      label: dto.label,
      href: dto.href,
      showInHeader: dto.showInHeader,
      showInFooter: dto.showInFooter,
      published: dto.published,
    });
  }
}
