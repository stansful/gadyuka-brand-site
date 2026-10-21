import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { OfferListResponse } from './offer-list.response';
import { OFFER_LIST_ROUTE } from './offer-list.route';
import { OfferListUsecase } from './offer-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class OfferListController {
  constructor(private readonly usecase: OfferListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Спецпредложения', description: 'Все спецпредложения в порядке показа; истёкшие отмечены.' })
  @ApiOkResponse({ type: OfferListResponse })
  @Get(OFFER_LIST_ROUTE)
  async execute(): Promise<OfferListResponse> {
    return this.usecase.execute();
  }
}
