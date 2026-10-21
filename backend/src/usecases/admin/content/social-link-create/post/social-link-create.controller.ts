import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { SocialLinkInputDto } from '~usecases/admin/content/common/socials/social-link-input.dto';

import { SOCIAL_LINK_CREATE_ROUTE } from './social-link-create.route';
import { SocialLinkCreateUsecase } from './social-link-create.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SocialLinkCreateController {
  constructor(private readonly usecase: SocialLinkCreateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новая ссылка на соцсеть', description: 'Добавляет ссылку в конец списка.' })
  @ApiCreatedResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation' })
  @Post(SOCIAL_LINK_CREATE_ROUTE)
  async execute(@Body() dto: SocialLinkInputDto): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({ type: dto.type, url: dto.url, label: dto.label, published: dto.published });
  }
}
