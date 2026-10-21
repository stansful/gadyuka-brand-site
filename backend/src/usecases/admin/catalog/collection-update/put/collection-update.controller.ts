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
import { CollectionSaveDto } from '~usecases/admin/catalog/common/collections/collection-save.dto';
import { RowIdPipe } from '~usecases/admin/common/row-id.pipe';

import { COLLECTION_UPDATE_ROUTE } from './collection-update.route';
import { CollectionUpdateUsecase } from './collection-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class CollectionUpdateController {
  constructor(private readonly usecase: CollectionUpdateUsecase) {}

  @ApiTags('admin')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Сохранить коллекцию', description: 'Форма коллекции; позиция в списке не меняется.' })
  @ApiOkResponse({ type: CatalogRowSavedResponse })
  @ApiBadRequestResponse({
    description: 'error: validation | badRequest (admin.errors.invalidId, admin.errors.missingMedia)',
  })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @ApiConflictResponse({ description: 'error: conflict (admin.errors.slugTaken, admin.errors.duplicate)' })
  @Put(COLLECTION_UPDATE_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string, @Body() dto: CollectionSaveDto): Promise<CatalogRowSavedResponse> {
    const { slug, title, description, coverId, published } = dto;
    return this.usecase.execute({ id, slug, title, description, coverId, published });
  }
}
