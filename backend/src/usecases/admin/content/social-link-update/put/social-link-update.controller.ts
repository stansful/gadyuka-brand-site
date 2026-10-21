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
import { SocialLinkInputDto } from '~usecases/admin/content/common/socials/social-link-input.dto';

import { SOCIAL_LINK_UPDATE_ROUTE } from './social-link-update.route';
import { SocialLinkUpdateUsecase } from './social-link-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SocialLinkUpdateController {
  constructor(private readonly usecase: SocialLinkUpdateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Сохранить ссылку на соцсеть', description: 'Форма редактирования ссылки на соцсеть.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Put(SOCIAL_LINK_UPDATE_ROUTE)
  async execute(
    @Param('id', RowIdPipe) id: string,
    @Body() dto: SocialLinkInputDto,
  ): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({ id, type: dto.type, url: dto.url, label: dto.label, published: dto.published });
  }
}
