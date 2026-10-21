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
import { OfferInputDto } from '~usecases/admin/content/common/offers/offer-input.dto';

import { OFFER_UPDATE_ROUTE } from './offer-update.route';
import { OfferUpdateUsecase } from './offer-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class OfferUpdateController {
  constructor(private readonly usecase: OfferUpdateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Сохранить спецпредложение', description: 'Форма редактирования спецпредложения.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({
    description: 'error: validation | badRequest (admin.errors.invalidId, missingMedia, admin.offers.ctaHrefRequired)',
  })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Put(OFFER_UPDATE_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string, @Body() dto: OfferInputDto): Promise<ContentEntitySavedResponse> {
    const texts = { title: dto.title, text: dto.text, badge: dto.badge, ctaLabel: dto.ctaLabel };
    return this.usecase.execute({
      id,
      ...texts,
      ctaHref: dto.ctaHref,
      validUntil: dto.validUntil,
      imageId: dto.imageId,
      published: dto.published,
    });
  }
}
