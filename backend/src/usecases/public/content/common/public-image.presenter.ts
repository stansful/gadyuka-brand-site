import { Injectable } from '@nestjs/common';

import type { ImageRef } from '~shared/contracts/common';

import { DEFAULT_LOCALE, Locale } from '~core/locales/locale.enum';
import { LocalizedTextValue } from '~core/locales/localized-text-value';

import { PublicMediaRow } from './public-media.select';

/** Media rows → pictures of the public site (port of the frontend's toImageRef). */
@Injectable()
export class PublicImagePresenter {
  /**
   * The alt text has no fallback in `alt`: a localized title the site passes as its own fallback
   * must win over the Russian alt on /en; the default-locale alt is kept separately (`altDefault`).
   */
  toImage(media: PublicMediaRow, locale: Locale): ImageRef {
    const alt = LocalizedTextValue.from(media.alt);
    return {
      id: media.id,
      src: media.url,
      width: media.width,
      height: media.height,
      mime: media.mime,
      alt: alt.readOwn(locale),
      altDefault: alt.read(DEFAULT_LOCALE),
    };
  }

  /** `toImage` of an optional relation (no media assigned → null). */
  toOptionalImage(media: PublicMediaRow | null, locale: Locale): ImageRef | null {
    return media === null ? null : this.toImage(media, locale);
  }
}
