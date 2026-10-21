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
import { OfferDetailsResponse } from '~usecases/admin/content/common/offers/offer-details.response';

import { OFFER_DETAILS_ROUTE } from './offer-details.route';
import { OfferDetailsUsecase } from './offer-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class OfferDetailsController {
  constructor(private readonly usecase: OfferDetailsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Спецпредложение', description: 'Спецпредложение для формы редактирования.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OfferDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Get(OFFER_DETAILS_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string): Promise<OfferDetailsResponse> {
    return this.usecase.execute({ id });
  }
}
