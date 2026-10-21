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

import { CollectionDetailsResponse } from './collection-details.response';
import { COLLECTION_DETAILS_ROUTE } from './collection-details.route';
import { CollectionDetailsUsecase } from './collection-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class CollectionDetailsController {
  constructor(private readonly usecase: CollectionDetailsUsecase) {}

  @ApiTags('admin')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Коллекция', description: 'Коллекция для формы редактирования.' })
  @ApiOkResponse({ type: CollectionDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Get(COLLECTION_DETAILS_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string): Promise<CollectionDetailsResponse> {
    return this.usecase.execute({ id });
  }
}
