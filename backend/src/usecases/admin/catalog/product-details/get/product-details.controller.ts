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

import { ProductDetailsResponse } from './product-details.response';
import { PRODUCT_DETAILS_ROUTE } from './product-details.route';
import { ProductDetailsUsecase } from './product-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ProductDetailsController {
  constructor(private readonly usecase: ProductDetailsUsecase) {}

  @ApiTags('admin')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Товар', description: 'Товар с фото (в порядке показа) для формы редактирования.' })
  @ApiOkResponse({ type: ProductDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Get(PRODUCT_DETAILS_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string): Promise<ProductDetailsResponse> {
    return this.usecase.execute({ id });
  }
}
