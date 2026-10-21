import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { OfferInputDto } from '~usecases/admin/content/common/offers/offer-input.dto';

import { OFFER_CREATE_ROUTE } from './offer-create.route';
import { OfferCreateUsecase } from './offer-create.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class OfferCreateController {
  constructor(private readonly usecase: OfferCreateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новое спецпредложение', description: 'Добавляет предложение в конец списка.' })
  @ApiCreatedResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({
    description: 'error: validation | badRequest (admin.errors.missingMedia, admin.offers.ctaHrefRequired)',
  })
  @Post(OFFER_CREATE_ROUTE)
  async execute(@Body() dto: OfferInputDto): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({
      title: dto.title,
      text: dto.text,
      badge: dto.badge,
      ctaLabel: dto.ctaLabel,
      ctaHref: dto.ctaHref,
      validUntil: dto.validUntil,
      imageId: dto.imageId,
      published: dto.published,
    });
  }
}
