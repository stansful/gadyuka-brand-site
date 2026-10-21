import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { ReviewSaveDto } from '~usecases/admin/catalog/common/reviews/review-save.dto';

import { REVIEW_CREATE_ROUTE } from './review-create.route';
import { ReviewCreateUsecase } from './review-create.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ReviewCreateController {
  constructor(private readonly usecase: ReviewCreateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новый отзыв', description: 'Добавляет отзыв последним в списке.' })
  @ApiCreatedResponse({ type: CatalogRowSavedResponse })
  @ApiBadRequestResponse({
    description: 'error: validation | badRequest (admin.reviews.ratingAboveScale, admin.errors.missingMedia)',
  })
  @HttpCode(HttpStatus.CREATED)
  @Post(REVIEW_CREATE_ROUTE)
  async execute(@Body() dto: ReviewSaveDto): Promise<CatalogRowSavedResponse> {
    const { author, role, text, avatarId, rating, published } = dto;
    return this.usecase.execute({ author, role, text, avatarId, rating, published });
  }
}
