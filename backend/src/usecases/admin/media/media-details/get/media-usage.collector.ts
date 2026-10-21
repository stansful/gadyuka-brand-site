import { Injectable } from '@nestjs/common';

import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { MediaUsageKind } from '~core/media/media-usage-kind.enum';

import { MediaUsageRows } from './media-details.repository';
import { MediaUsageLinks, RowUsageKind } from './media-usage.links';
import { MediaUsageResponse } from './media-usage.response';

type UsageSource = (rows: MediaUsageRows) => MediaUsageResponse[];

/**
 * The places that use a media file, built from its referencing rows (port of getMediaUsages of the
 * frontend's media-service.ts): one source per kind, listed in MediaUsageKind order. Titles are
 * the stored names in the default locale; the admin translates the kinds and fills in fallbacks.
 */
@Injectable()
export class MediaUsageCollector {
  private readonly links = new MediaUsageLinks();
  private readonly sources: Readonly<Record<MediaUsageKind, UsageSource>> = {
    [MediaUsageKind.LANDING_IMAGE]: rows => rows.contentImages.map(image => this.landingImage(image.key)),
    [MediaUsageKind.COLLECTION_COVER]: rows =>
      rows.collectionCovers.map(row => this.rowUsage(MediaUsageKind.COLLECTION_COVER, row.id, this.textOf(row.title))),
    [MediaUsageKind.PRODUCT_PHOTO]: rows =>
      rows.productImages.map(({ product }) =>
        this.rowUsage(MediaUsageKind.PRODUCT_PHOTO, product.id, this.textOf(product.title)),
      ),
    [MediaUsageKind.REVIEW_AVATAR]: rows =>
      rows.reviewAvatars.map(row => this.rowUsage(MediaUsageKind.REVIEW_AVATAR, row.id, row.author)),
    [MediaUsageKind.NEWS]: rows =>
      rows.newsImages.map(row => this.rowUsage(MediaUsageKind.NEWS, row.id, this.textOf(row.title))),
    [MediaUsageKind.GALLERY]: rows =>
      rows.galleryItems.map(row => this.rowUsage(MediaUsageKind.GALLERY, row.id, this.textOf(row.caption))),
    [MediaUsageKind.OFFER]: rows =>
      rows.offerImages.map(row => this.rowUsage(MediaUsageKind.OFFER, row.id, this.textOf(row.title))),
    [MediaUsageKind.PARTNER_LOGO]: rows =>
      rows.partnerLogos.map(row => this.rowUsage(MediaUsageKind.PARTNER_LOGO, row.id, row.name)),
    [MediaUsageKind.SETTINGS]: rows => rows.ogImageSettings.slice(0, 1).map(() => this.settingsUsage()),
  };

  collect(rows: MediaUsageRows): MediaUsageResponse[] {
    return Object.values(MediaUsageKind).flatMap(kind => this.sources[kind](rows));
  }

  /** "about.image" → the «about» section of the «Тексты сайта» page. */
  private landingImage(key: string): MediaUsageResponse {
    const section = key.split('.')[0] ?? key;
    return MediaUsageResponse.of({
      kind: MediaUsageKind.LANDING_IMAGE,
      href: this.links.contentSection(section),
      title: '',
      contentKey: key,
    });
  }

  private rowUsage(kind: RowUsageKind, id: string, title: string): MediaUsageResponse {
    return MediaUsageResponse.of({ kind, href: this.links.rowPage(kind, id), title, contentKey: null });
  }

  private settingsUsage(): MediaUsageResponse {
    return MediaUsageResponse.of({
      kind: MediaUsageKind.SETTINGS,
      href: this.links.settingsPage(),
      title: '',
      contentKey: null,
    });
  }

  private textOf(value: unknown): string {
    return LocalizedTextValue.from(value).defaultText();
  }
}
