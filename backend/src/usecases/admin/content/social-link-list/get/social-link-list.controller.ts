import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { SocialLinkListResponse } from './social-link-list.response';
import { SOCIAL_LINK_LIST_ROUTE } from './social-link-list.route';
import { SocialLinkListUsecase } from './social-link-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SocialLinkListController {
  constructor(private readonly usecase: SocialLinkListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Соцсети', description: 'Все ссылки на соцсети в порядке показа; заглушки отмечены.' })
  @ApiOkResponse({ type: SocialLinkListResponse })
  @Get(SOCIAL_LINK_LIST_ROUTE)
  async execute(): Promise<SocialLinkListResponse> {
    return this.usecase.execute();
  }
}
