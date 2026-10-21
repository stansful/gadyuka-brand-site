import { Body, Controller, Param, Put } from '@nestjs/common';
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
import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { ReviewSaveDto } from '~usecases/admin/catalog/common/reviews/review-save.dto';
import { RowIdPipe } from '~usecases/admin/common/row-id.pipe';

import { REVIEW_UPDATE_ROUTE } from './review-update.route';
import { ReviewUpdateUsecase } from './review-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ReviewUpdateController {
  constructor(private readonly usecase: ReviewUpdateUsecase) {}

  @ApiTags('admin')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Сохранить отзыв', description: 'Форма отзыва; позиция в списке не меняется.' })
  @ApiOkResponse({ type: CatalogRowSavedResponse })
  @ApiBadRequestResponse({
    description:
      'error: validation | badRequest (admin.errors.invalidId, admin.reviews.ratingAboveScale, admin.errors.missingMedia)',
  })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Put(REVIEW_UPDATE_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string, @Body() dto: ReviewSaveDto): Promise<CatalogRowSavedResponse> {
    const { author, role, text, avatarId, rating, published } = dto;
    return this.usecase.execute({ id, author, role, text, avatarId, rating, published });
  }
}
