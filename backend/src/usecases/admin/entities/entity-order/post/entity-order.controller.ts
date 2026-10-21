import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { EntityOrderParamsDto } from './entity-order-params.dto';
import { EntityOrderDto } from './entity-order.dto';
import { ENTITY_ORDER_ROUTE } from './entity-order.route';
import { EntityOrderUsecase } from './entity-order.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class EntityOrderController {
  constructor(private readonly usecase: EntityOrderUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Порядок строк списка', description: 'Перетаскивание: ids[i] получает порядок i.' })
  @ApiNoContentResponse({ description: 'Saved' })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.entities.invalidOrder)' })
  @ApiNotFoundResponse({ description: 'error: notFound (a row of the list is gone)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(ENTITY_ORDER_ROUTE)
  async execute(@Param() params: EntityOrderParamsDto, @Body() dto: EntityOrderDto): Promise<void> {
    await this.usecase.execute({ kind: params.kind, ids: dto.ids });
  }
}
