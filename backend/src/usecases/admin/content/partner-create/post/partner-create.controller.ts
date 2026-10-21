import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { PartnerInputDto } from '~usecases/admin/content/common/partners/partner-input.dto';

import { PARTNER_CREATE_ROUTE } from './partner-create.route';
import { PartnerCreateUsecase } from './partner-create.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class PartnerCreateController {
  constructor(private readonly usecase: PartnerCreateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новый партнёр', description: 'Добавляет партнёра в конец списка.' })
  @ApiCreatedResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.missingMedia)' })
  @Post(PARTNER_CREATE_ROUTE)
  async execute(@Body() dto: PartnerInputDto): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({
      name: dto.name,
      url: dto.url,
      logoId: dto.logoId,
      description: dto.description,
      published: dto.published,
    });
  }
}
