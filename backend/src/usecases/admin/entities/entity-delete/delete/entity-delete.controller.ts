import { Controller, Delete, HttpCode, HttpStatus, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { EntityParamsDto } from '~usecases/admin/entities/common/entity-params.dto';

import { ENTITY_DELETE_ROUTE } from './entity-delete.route';
import { EntityDeleteUsecase } from './entity-delete.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class EntityDeleteController {
  constructor(private readonly usecase: EntityDeleteUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Удалить строку списка', description: 'Картинки остаются в медиатеке.' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiBadRequestResponse({ description: 'error: validation (kind, id)' })
  @ApiNotFoundResponse({ description: 'error: notFound' })
  @ApiConflictResponse({ description: 'error: conflict (admin.errors.related)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(ENTITY_DELETE_ROUTE)
  async execute(@Param() params: EntityParamsDto): Promise<void> {
    await this.usecase.execute({ kind: params.kind, id: params.id });
  }
}
