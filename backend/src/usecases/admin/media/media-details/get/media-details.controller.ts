import { Controller, Get, Param } from '@nestjs/common';
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
import { MediaIdParamsDto } from '~usecases/admin/media/common/media-id-params.dto';

import { MediaDetailsResponse } from './media-details.response';
import { MEDIA_DETAILS_ROUTE } from './media-details.route';
import { MediaDetailsUsecase } from './media-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MediaDetailsController {
  constructor(private readonly usecase: MediaDetailsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Файл медиатеки', description: 'Файл и все места, где он используется (со ссылками).' })
  @ApiOkResponse({ type: MediaDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: validation (id: admin.validation.idInvalid)' })
  @ApiNotFoundResponse({ description: 'admin.media.errors.notFound' })
  @Get(MEDIA_DETAILS_ROUTE)
  async execute(@Param() params: MediaIdParamsDto): Promise<MediaDetailsResponse> {
    return this.usecase.execute({ id: params.id });
  }
}
