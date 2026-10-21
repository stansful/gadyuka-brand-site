import { Body, Controller, Param, Put } from '@nestjs/common';
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
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { PartnerInputDto } from '~usecases/admin/content/common/partners/partner-input.dto';

import { PARTNER_UPDATE_ROUTE } from './partner-update.route';
import { PartnerUpdateUsecase } from './partner-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class PartnerUpdateController {
  constructor(private readonly usecase: PartnerUpdateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Сохранить партнёра', description: 'Форма редактирования партнёра.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.invalidId, missingMedia)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Put(PARTNER_UPDATE_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string, @Body() dto: PartnerInputDto): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({
      id,
      name: dto.name,
      url: dto.url,
      logoId: dto.logoId,
      description: dto.description,
      published: dto.published,
    });
  }
}
