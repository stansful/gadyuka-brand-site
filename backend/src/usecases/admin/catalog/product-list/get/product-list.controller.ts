import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { ProductListResponse } from './product-list.response';
import { PRODUCT_LIST_ROUTE } from './product-list.route';
import { ProductListUsecase } from './product-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ProductListController {
  constructor(private readonly usecase: ProductListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Товары',
    description: 'Товары по коллекциям в порядке сайта: главное фото, цена, число фото.',
  })
  @ApiOkResponse({ type: ProductListResponse })
  @Get(PRODUCT_LIST_ROUTE)
  async execute(): Promise<ProductListResponse> {
    return this.usecase.execute();
  }
}
