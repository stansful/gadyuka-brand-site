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

import { ReviewDetailsResponse } from './review-details.response';
import { REVIEW_DETAILS_ROUTE } from './review-details.route';
import { ReviewDetailsUsecase } from './review-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ReviewDetailsController {
  constructor(private readonly usecase: ReviewDetailsUsecase) {}

  @ApiTags('admin')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Отзыв', description: 'Отзыв для формы редактирования.' })
  @ApiOkResponse({ type: ReviewDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Get(REVIEW_DETAILS_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string): Promise<ReviewDetailsResponse> {
    return this.usecase.execute({ id });
  }
}
