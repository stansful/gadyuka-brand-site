import { Injectable, Logger } from '@nestjs/common';

import { LocalizedTextValue, TranslationsInput } from '~core/locales/localized-text-value';
import { PickedMediaChecker } from '~usecases/admin/common/media/picked-media.checker';
import { Usecase } from '~usecases/usecase.interfaces';

import { RatingScaleTooLowException } from './rating-scale-too-low.exception';
import { SettingsUpdateRepository, SiteSettingsWrite } from './settings-update.repository';

export interface SettingsUpdateCommand {
  readonly phone: string;
  readonly email: string;
  readonly address: TranslationsInput;
  readonly reviewRatingMax: number;
  readonly seoTitle: TranslationsInput;
  readonly seoDescription: TranslationsInput;
  readonly ogImageId: string | null;
}

/**
 * Saves the single settings row: contacts, the review star scale, SEO, OG image (social links are
 * SocialLink rows). Refused (in this order): a deleted OG image (400 missingMedia), a scale below a
 * stored rating (409 scaleTooLow with the number of such reviews).
 */
@Injectable()
export class SettingsUpdateUsecase implements Usecase<SettingsUpdateCommand, void> {
  private readonly logger = new Logger(SettingsUpdateUsecase.name);

  constructor(
    private readonly repository: SettingsUpdateRepository,
    private readonly media: PickedMediaChecker,
  ) {}

  async execute(command: SettingsUpdateCommand): Promise<void> {
    const settings = this.toWrite(command);
    await this.media.assertExist([settings.ogImageId]);
    await this.assertScaleHoldsRatings(settings.reviewRatingMax);
    await this.repository.save(settings);
    this.logger.log('SettingsUpdateUsecase : saved', { review_rating_max: settings.reviewRatingMax });
  }

  private async assertScaleHoldsRatings(max: number): Promise<void> {
    const aboveScale = await this.repository.countRatedAbove(max);
    if (aboveScale > 0) {
      throw new RatingScaleTooLowException(aboveScale, max);
    }
  }

  private toWrite({ address, seoTitle, seoDescription, ...plain }: SettingsUpdateCommand): SiteSettingsWrite {
    return {
      ...plain,
      address: LocalizedTextValue.normalize(address),
      seoTitle: LocalizedTextValue.normalize(seoTitle),
      seoDescription: LocalizedTextValue.normalize(seoDescription),
    };
  }
}
