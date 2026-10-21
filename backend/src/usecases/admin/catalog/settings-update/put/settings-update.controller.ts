import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { SettingsUpdateDto } from './settings-update.dto';
import { SETTINGS_UPDATE_ROUTE } from './settings-update.route';
import { SettingsUpdateUsecase } from './settings-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SettingsUpdateController {
  constructor(private readonly usecase: SettingsUpdateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Сохранить настройки',
    description: 'Шкалу оценки нельзя сделать меньше сохранённой оценки отзыва (409 с числом таких отзывов).',
  })
  @ApiNoContentResponse({ description: 'Saved' })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.missingMedia)' })
  @ApiConflictResponse({ description: 'error: conflict (admin.settings.scaleTooLow { count, max })' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put(SETTINGS_UPDATE_ROUTE)
  async execute(@Body() dto: SettingsUpdateDto): Promise<void> {
    const { phone, email, address, reviewRatingMax, seoTitle, seoDescription, ogImageId } = dto;
    await this.usecase.execute({ phone, email, address, reviewRatingMax, seoTitle, seoDescription, ogImageId });
  }
}
