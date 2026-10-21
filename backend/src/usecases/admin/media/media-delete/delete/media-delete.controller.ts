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
import { MediaIdParamsDto } from '~usecases/admin/media/common/media-id-params.dto';

import { MEDIA_DELETE_ROUTE } from './media-delete.route';
import { MediaDeleteUsecase } from './media-delete.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MediaDeleteController {
  constructor(private readonly usecase: MediaDeleteUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Удалить файл медиатеки',
    description: 'Только неиспользуемый файл: строка, затем файл в хранилище.',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiBadRequestResponse({ description: 'error: validation (id: admin.validation.idInvalid)' })
  @ApiNotFoundResponse({ description: 'admin.media.errors.notFoundDeleted' })
  @ApiConflictResponse({ description: 'admin.media.errors.inUse (details.usageCount) | admin.errors.related' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(MEDIA_DELETE_ROUTE)
  async execute(@Param() params: MediaIdParamsDto): Promise<void> {
    await this.usecase.execute({ id: params.id });
  }
}
