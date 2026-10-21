import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { ReviewListDto } from './review-list.dto';
import { ReviewListResponse } from './review-list.response';
import { REVIEW_LIST_ROUTE } from './review-list.route';
import { ReviewListUsecase } from './review-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ReviewListController {
  constructor(private readonly usecase: ReviewListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Отзывы',
    description: 'Отзывы в порядке сайта и текущая шкала оценки; ratingAbove — только с оценкой выше.',
  })
  @ApiOkResponse({ type: ReviewListResponse })
  @ApiBadRequestResponse({ description: 'error: validation (ratingAbove: admin.validation.invalid)' })
  @Get(REVIEW_LIST_ROUTE)
  async execute(@Query() dto: ReviewListDto): Promise<ReviewListResponse> {
    return this.usecase.execute({ ratingAbove: dto.ratingAbove });
  }
}
