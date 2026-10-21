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
import { PartnerDetailsResponse } from '~usecases/admin/content/common/partners/partner-details.response';

import { PARTNER_DETAILS_ROUTE } from './partner-details.route';
import { PartnerDetailsUsecase } from './partner-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class PartnerDetailsController {
  constructor(private readonly usecase: PartnerDetailsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Партнёр', description: 'Партнёр для формы редактирования.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PartnerDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Get(PARTNER_DETAILS_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string): Promise<PartnerDetailsResponse> {
    return this.usecase.execute({ id });
  }
}
