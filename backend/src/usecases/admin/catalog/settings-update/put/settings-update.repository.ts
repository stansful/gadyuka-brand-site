import { Injectable } from '@nestjs/common';

import type { LocalizedText } from '~shared/contracts/common';

import { SITE_SETTINGS_ID } from '~core/constants/site-settings.constants';
import { DatabaseService } from '~database';

/** The site settings as stored (one row, id = 1). */
export interface SiteSettingsWrite {
  readonly phone: string;
  readonly email: string;
  readonly address: LocalizedText;
  readonly reviewRatingMax: number;
  readonly seoTitle: LocalizedText;
  readonly seoDescription: LocalizedText;
  readonly ogImageId: string | null;
}

@Injectable()
export class SettingsUpdateRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Reviews rated higher than `rating`. */
  async countRatedAbove(rating: number): Promise<number> {
    return this.database.client.review.count({ where: { rating: { gt: rating } } });
  }

  /** Creates the settings row on the first save, overwrites it afterwards. */
  async save(settings: SiteSettingsWrite): Promise<void> {
    await this.database.client.siteSettings.upsert({
      where: { id: SITE_SETTINGS_ID },
      create: { id: SITE_SETTINGS_ID, ...settings },
      update: settings,
      select: { id: true },
    });
  }
}
