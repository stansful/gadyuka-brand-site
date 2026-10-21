import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { CatalogRowSavedResponse } from '~usecases/admin/catalog/common/catalog-row-saved.response';
import { ProductSaveDto } from '~usecases/admin/catalog/common/products/product-save.dto';

import { PRODUCT_CREATE_ROUTE } from './product-create.route';
import { ProductCreateUsecase } from './product-create.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ProductCreateController {
  constructor(private readonly usecase: ProductCreateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Новый товар',
    description: 'Создаёт товар последним в коллекции, фото — в порядке imageIds.',
  })
  @ApiCreatedResponse({ type: CatalogRowSavedResponse })
  @ApiBadRequestResponse({
    description: 'error: validation | badRequest (admin.products.collectionNotFound, admin.errors.missingMedia)',
  })
  @ApiConflictResponse({ description: 'error: conflict (admin.errors.slugTaken, admin.errors.duplicate)' })
  @HttpCode(HttpStatus.CREATED)
  @Post(PRODUCT_CREATE_ROUTE)
  async execute(@Body() dto: ProductSaveDto): Promise<CatalogRowSavedResponse> {
    const { slug, collectionId, title, description, details, price, imageIds, published } = dto;
    return this.usecase.execute({ slug, collectionId, title, description, details, price, imageIds, published });
  }
}
