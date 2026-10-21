import { Injectable } from '@nestjs/common';

import { Locale } from '~core/locales/locale.enum';
import { FlatMessages } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';
import {
  PublicSettingsRepository,
  PublicSettingsRow,
} from '~usecases/public/content/common/public-settings.repository';
import {
  PublicCollectionRow,
  PublishedCollectionsRepository,
} from '~usecases/public/content/common/published-collections.repository';

import { LandingFrameRows, LandingRepository, LandingSectionRows } from './landing.repository';

/** Everything the landing renders, as read (not localized yet). */
export interface LandingRows {
  /** The resolved site messages of the locale (admin edits over shared/messages) */
  readonly texts: FlatMessages;
  readonly settings: PublicSettingsRow | null;
  readonly collections: readonly PublicCollectionRow[];
  readonly frame: LandingFrameRows;
  readonly sections: LandingSectionRows;
}

/** Reads every part of the landing at once (parallel queries; the site messages from their cache). */
@Injectable()
export class LandingRowsLoader {
  constructor(
    private readonly landing: LandingRepository,
    private readonly collections: PublishedCollectionsRepository,
    private readonly settings: PublicSettingsRepository,
    private readonly siteMessages: SiteMessagesService,
  ) {}

  /** `now`: the moment that decides which offers are over. */
  async load(locale: Locale, now: Date): Promise<LandingRows> {
    const [texts, settings, collections, frame, sections] = await Promise.all([
      this.siteMessages.findValues(locale),
      this.settings.findSettings(),
      this.collections.findAll(),
      this.landing.findFrame(),
      this.landing.findSections(now),
    ]);
    return { texts, settings, collections, frame, sections };
  }
}
