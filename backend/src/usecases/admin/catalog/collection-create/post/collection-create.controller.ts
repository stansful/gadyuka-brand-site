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
import { CollectionSaveDto } from '~usecases/admin/catalog/common/collections/collection-save.dto';

import { COLLECTION_CREATE_ROUTE } from './collection-create.route';
import { CollectionCreateUsecase } from './collection-create.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class CollectionCreateController {
  constructor(private readonly usecase: CollectionCreateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новая коллекция', description: 'Создаёт коллекцию последней в списке.' })
  @ApiCreatedResponse({ type: CatalogRowSavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.missingMedia)' })
  @ApiConflictResponse({ description: 'error: conflict (admin.errors.slugTaken, admin.errors.duplicate)' })
  @HttpCode(HttpStatus.CREATED)
  @Post(COLLECTION_CREATE_ROUTE)
  async execute(@Body() dto: CollectionSaveDto): Promise<CatalogRowSavedResponse> {
    const { slug, title, description, coverId, published } = dto;
    return this.usecase.execute({ slug, title, description, coverId, published });
  }
}
