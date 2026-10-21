import { MediaUsageKind } from '~core/media/media-usage-kind.enum';

/** Kinds whose place is a row with its own admin page ("/admin/<section>/<id>"). */
export type RowUsageKind = Exclude<MediaUsageKind, MediaUsageKind.LANDING_IMAGE | MediaUsageKind.SETTINGS>;

/** Admin pages (routes of the frontend's admin) where a place that uses a file is edited. */
export class MediaUsageLinks {
  private static readonly ROW_PAGES: Readonly<Record<RowUsageKind, string>> = {
    [MediaUsageKind.COLLECTION_COVER]: '/admin/collections',
    [MediaUsageKind.PRODUCT_PHOTO]: '/admin/products',
    [MediaUsageKind.REVIEW_AVATAR]: '/admin/reviews',
    [MediaUsageKind.NEWS]: '/admin/news',
    [MediaUsageKind.GALLERY]: '/admin/gallery',
    [MediaUsageKind.OFFER]: '/admin/offers',
    [MediaUsageKind.PARTNER_LOGO]: '/admin/partners',
  };
  private static readonly CONTENT_PAGE = '/admin/content';
  private static readonly SETTINGS_PAGE = '/admin/settings';

  /** "/admin/products/<id>" */
  rowPage(kind: RowUsageKind, id: string): string {
    return `${MediaUsageLinks.ROW_PAGES[kind]}/${id}`;
  }

  /** The «Тексты сайта» page of a landing section: "/admin/content?section=about". */
  contentSection(section: string): string {
    return `${MediaUsageLinks.CONTENT_PAGE}?section=${encodeURIComponent(section)}`;
  }

  settingsPage(): string {
    return MediaUsageLinks.SETTINGS_PAGE;
  }
}
