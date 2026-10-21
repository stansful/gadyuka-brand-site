import { Body, Controller, Param, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { ProductSaveDto } from '~usecases/admin/catalog/common/products/product-save.dto';
import { RowIdPipe } from '~usecases/admin/common/row-id.pipe';

import { PRODUCT_UPDATE_ROUTE } from './product-update.route';
import { ProductUpdateUsecase } from './product-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ProductUpdateController {
  constructor(private readonly usecase: ProductUpdateUsecase) {}

  @ApiTags('admin')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Сохранить товар',
    description: 'Форма товара: фото в порядке imageIds; товар, перенесённый в другую коллекцию, встаёт в её конец.',
  })
  @ApiOkResponse({ type: CatalogRowSavedResponse })
  @ApiBadRequestResponse({
    description:
      'error: validation | badRequest (admin.errors.invalidId, admin.products.collectionNotFound, admin.errors.missingMedia)',
  })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.products.notFound)' })
  @ApiConflictResponse({ description: 'error: conflict (admin.errors.slugTaken, admin.errors.duplicate)' })
  @Put(PRODUCT_UPDATE_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string, @Body() dto: ProductSaveDto): Promise<CatalogRowSavedResponse> {
    const { slug, collectionId, title, description, details, price, imageIds, published } = dto;
    return this.usecase.execute({ id, slug, collectionId, title, description, details, price, imageIds, published });
  }
}
