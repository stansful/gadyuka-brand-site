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
import { SocialLinkDetailsResponse } from '~usecases/admin/content/common/socials/social-link-details.response';

import { SOCIAL_LINK_DETAILS_ROUTE } from './social-link-details.route';
import { SocialLinkDetailsUsecase } from './social-link-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SocialLinkDetailsController {
  constructor(private readonly usecase: SocialLinkDetailsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Соцсеть', description: 'Ссылка на соцсеть для формы редактирования.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SocialLinkDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Get(SOCIAL_LINK_DETAILS_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string): Promise<SocialLinkDetailsResponse> {
    return this.usecase.execute({ id });
  }
}
