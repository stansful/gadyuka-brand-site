import { Injectable } from '@nestjs/common';

import { SITE_SETTINGS_ID } from '~core/constants/site-settings.constants';
import { ReviewRatingScale } from '~core/reviews/review-rating-scale';
import { DatabaseService } from '~database';

/** The current star scale of review ratings (SiteSettings.reviewRatingMax). */
@Injectable()
export class RatingScaleRepository {
  constructor(private readonly database: DatabaseService) {}

  /** The stored scale, or the default before the settings are saved for the first time. */
  async findScale(): Promise<ReviewRatingScale> {
    const row = await this.database.client.siteSettings.findUnique({
      where: { id: SITE_SETTINGS_ID },
      select: { reviewRatingMax: true },
    });
    return ReviewRatingScale.of(row?.reviewRatingMax);
  }
}
