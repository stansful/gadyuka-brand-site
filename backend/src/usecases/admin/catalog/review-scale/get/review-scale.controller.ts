import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { ReviewScaleResponse } from './review-scale.response';
import { REVIEW_SCALE_ROUTE } from './review-scale.route';
import { ReviewScaleUsecase } from './review-scale.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ReviewScaleController {
  constructor(private readonly usecase: ReviewScaleUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Шкала оценки отзывов', description: 'Сколько звёзд в оценке (настройки сайта).' })
  @ApiOkResponse({ type: ReviewScaleResponse })
  @Get(REVIEW_SCALE_ROUTE)
  async execute(): Promise<ReviewScaleResponse> {
    return this.usecase.execute();
  }
}
