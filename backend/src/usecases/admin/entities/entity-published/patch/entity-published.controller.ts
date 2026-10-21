import { Body, Controller, Param, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { EntityParamsDto } from '~usecases/admin/entities/common/entity-params.dto';

import { EntityPublishedDto } from './entity-published.dto';
import { EntityPublishedResponse } from './entity-published.response';
import { ENTITY_PUBLISHED_ROUTE } from './entity-published.route';
import { EntityPublishedUsecase } from './entity-published.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class EntityPublishedController {
  constructor(private readonly usecase: EntityPublishedUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Показать / скрыть на сайте', description: 'Переключатель публикации строки списка.' })
  @ApiOkResponse({ type: EntityPublishedResponse })
  @ApiBadRequestResponse({ description: 'error: validation (kind, id, published)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Patch(ENTITY_PUBLISHED_ROUTE)
  async execute(@Param() params: EntityParamsDto, @Body() dto: EntityPublishedDto): Promise<EntityPublishedResponse> {
    return this.usecase.execute({ kind: params.kind, id: params.id, published: dto.published });
  }
}
