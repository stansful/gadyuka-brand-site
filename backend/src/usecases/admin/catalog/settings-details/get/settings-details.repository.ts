import { Injectable } from '@nestjs/common';

import type { AdminSiteSettingsResponse } from '~shared/contracts/catalog';

import { SITE_SETTINGS_ID } from '~core/constants/site-settings.constants';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { MediaRefRecord, MediaRefRow } from '~usecases/admin/common/media/media-ref.record';

interface SettingsRow {
  readonly phone: string;
  readonly email: string;
  readonly address: unknown;
  readonly reviewRatingMax: number;
  readonly seoTitle: unknown;
  readonly seoDescription: unknown;
  readonly ogImage: MediaRefRow | null;
}

@Injectable()
export class SettingsDetailsRepository {
  private static readonly SELECT = {
    phone: true,
    email: true,
    address: true,
    reviewRatingMax: true,
    seoTitle: true,
    seoDescription: true,
    ogImage: { select: MediaRefRecord.SELECT },
  } as const;

  constructor(private readonly database: DatabaseService) {}

  /** The settings row (null before the first save). */
  async findSettings(): Promise<AdminSiteSettingsResponse | null> {
    const row = await this.database.client.siteSettings.findUnique({
      where: { id: SITE_SETTINGS_ID },
      select: SettingsDetailsRepository.SELECT,
    });
    return row === null ? null : this.toSettings(row);
  }

  private toSettings({ address, seoTitle, seoDescription, ogImage, ...row }: SettingsRow): AdminSiteSettingsResponse {
    return {
      ...row,
      address: LocalizedTextValue.parse(address),
      seoTitle: LocalizedTextValue.parse(seoTitle),
      seoDescription: LocalizedTextValue.parse(seoDescription),
      ogImage: MediaRefRecord.toNullableMediaRef(ogImage),
    };
  }
}
