import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { GalleryListResponse } from './gallery-list.response';
import { GALLERY_LIST_ROUTE } from './gallery-list.route';
import { GalleryListUsecase } from './gallery-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class GalleryListController {
  constructor(private readonly usecase: GalleryListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Галерея', description: 'Все фото галереи в порядке показа на сайте.' })
  @ApiOkResponse({ type: GalleryListResponse })
  @Get(GALLERY_LIST_ROUTE)
  async execute(): Promise<GalleryListResponse> {
    return this.usecase.execute();
  }
}
