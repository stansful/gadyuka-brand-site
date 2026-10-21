import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { PartnerListResponse } from './partner-list.response';
import { PARTNER_LIST_ROUTE } from './partner-list.route';
import { PartnerListUsecase } from './partner-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class PartnerListController {
  constructor(private readonly usecase: PartnerListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Партнёры', description: 'Все партнёры в порядке показа на сайте.' })
  @ApiOkResponse({ type: PartnerListResponse })
  @Get(PARTNER_LIST_ROUTE)
  async execute(): Promise<PartnerListResponse> {
    return this.usecase.execute();
  }
}
