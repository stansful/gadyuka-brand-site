import { Injectable } from '@nestjs/common';

import { SITE_SETTINGS_ID } from '~core/constants/site-settings.constants';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

import { PUBLIC_MEDIA_SELECT, PublicMediaRow } from './public-media.select';

const SETTINGS_SELECT = {
  phone: true,
  email: true,
  address: true,
  reviewRatingMax: true,
  seoTitle: true,
  seoDescription: true,
  ogImage: { select: PUBLIC_MEDIA_SELECT },
} satisfies Prisma.SiteSettingsSelect;

/** The SiteSettings row as the site reads it (LocalizedText fields as stored). */
export interface PublicSettingsRow {
  readonly phone: string;
  readonly email: string;
  readonly address: unknown;
  readonly reviewRatingMax: number;
  readonly seoTitle: unknown;
  readonly seoDescription: unknown;
  readonly ogImage: PublicMediaRow | null;
}

/** The single SiteSettings row (id = 1). */
@Injectable()
export class PublicSettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** null until the admin (or the seed) saved the settings once. */
  findSettings(): Promise<PublicSettingsRow | null> {
    return this.database.client.siteSettings.findUnique({ where: { id: SITE_SETTINGS_ID }, select: SETTINGS_SELECT });
  }
}
