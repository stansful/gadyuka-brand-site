import { Controller, Get, Param } from '@nestjs/common';
import { ApiBadRequestResponse, ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '~decorator';
import { PublicImageView } from '~usecases/public/content/common/views/public-image.view';

import { LandingDto } from './landing.dto';
import { LandingResponse } from './landing.response';
import { LANDING_ROUTE } from './landing.route';
import { LandingUsecase } from './landing.usecase';

@ApiExtraModels(PublicImageView)
@Controller()
export class LandingController {
  constructor(private readonly usecase: LandingUsecase) {}

  @ApiTags('public')
  @ApiOperation({
    summary: 'Лендинг',
    description:
      'Всё, что показывает лендинг на языке: тексты, картинки, меню, соцсети, опубликованные коллекции, ' +
      'отзывы, новости, галерея, действующие предложения, партнёры, настройки.',
  })
  @ApiOkResponse({ type: LandingResponse })
  @ApiBadRequestResponse({ description: 'error: validation (locale: admin.validation.invalid)' })
  @Public()
  @Get(LANDING_ROUTE)
  async execute(@Param() dto: LandingDto): Promise<LandingResponse> {
    return this.usecase.execute({ locale: dto.locale });
  }
}
