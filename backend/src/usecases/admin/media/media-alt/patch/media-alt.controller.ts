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
import { MediaIdParamsDto } from '~usecases/admin/media/common/media-id-params.dto';

import { MediaAltDto } from './media-alt.dto';
import { MediaAltResponse } from './media-alt.response';
import { MEDIA_ALT_ROUTE } from './media-alt.route';
import { MediaAltUsecase } from './media-alt.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MediaAltController {
  constructor(private readonly usecase: MediaAltUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Описание (alt) файла',
    description: 'Alt на каждом языке; пустые переводы не сохраняются.',
  })
  @ApiOkResponse({ type: MediaAltResponse })
  @ApiBadRequestResponse({ description: 'error: validation (id, alt.<locale>: admin.validation.tooLong { max })' })
  @ApiNotFoundResponse({ description: 'admin.errors.notFound' })
  @Patch(MEDIA_ALT_ROUTE)
  async execute(@Param() params: MediaIdParamsDto, @Body() dto: MediaAltDto): Promise<MediaAltResponse> {
    return this.usecase.execute({ id: params.id, alt: { ru: dto.alt.ru, en: dto.alt.en } });
  }
}
