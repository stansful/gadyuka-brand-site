import { Injectable } from '@nestjs/common';

import type { ImageRef } from '~shared/contracts/common';
import type { PublicMenuItem, PublicSocialLink } from '~shared/contracts/content';

import { Locale } from '~core/locales/locale.enum';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { PublicImagePresenter } from '~usecases/public/content/common/public-image.presenter';

import { ContentImageRow, MenuItemRow, SocialLinkRow } from './landing.repository';

/** The page frame of the landing (images, menu, social links) → localized views. */
@Injectable()
export class LandingFramePresenter {
  constructor(private readonly images: PublicImagePresenter) {}

  /** { "about.image": ImageRef | null } — a row without media is null. */
  toImages(rows: readonly ContentImageRow[], locale: Locale): Record<string, ImageRef | null> {
    return Object.fromEntries(rows.map(row => [row.key, this.images.toOptionalImage(row.media, locale)]));
  }

  /** Labels fall back to ru; an item without a label in any locale is left out. */
  toMenu(rows: readonly MenuItemRow[], locale: Locale): PublicMenuItem[] {
    return rows.flatMap(row => {
      const label = LocalizedTextValue.from(row.label).read(locale);
      if (label === '') {
        return [];
      }
      return [{ id: row.id, label, href: row.href, showInHeader: row.showInHeader, showInFooter: row.showInFooter }];
    });
  }

  /** An empty label is null: the site then shows its default label (message `social.<type>`). */
  toSocials(rows: readonly SocialLinkRow[], locale: Locale): PublicSocialLink[] {
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      url: row.url,
      label: LocalizedTextValue.from(row.label).readOptional(locale),
    }));
  }
}
