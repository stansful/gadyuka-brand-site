/** A timestamp that may be missing (an empty table, an optional relation). */
export type ChangeTime = Date | null | undefined;

/** The latest changes of one collection page's rows (hidden products and their images count too). */
export interface CollectionPageChanges {
  readonly slug: string;
  readonly updatedAt: Date;
  readonly coverUpdatedAt: ChangeTime;
  /** The latest change of its products */
  readonly productsUpdatedAt: ChangeTime;
  /** The latest change of the media of its products' images (an edited alt text) */
  readonly imagesUpdatedAt: ChangeTime;
}

/** The latest updatedAt of every table the public pages render (null: an empty table). */
export interface ContentLastChanges {
  readonly messages: ChangeTime;
  readonly menuItems: ChangeTime;
  readonly socialLinks: ChangeTime;
  readonly settings: ChangeTime;
  readonly contentImages: ChangeTime;
  readonly media: ChangeTime;
  readonly reviews: ChangeTime;
  readonly news: ChangeTime;
  readonly gallery: ChangeTime;
  readonly offers: ChangeTime;
  readonly partners: ChangeTime;
  readonly collections: ChangeTime;
  readonly products: ChangeTime;
}

/** The latest changes of the site, grouped by the pages that render them. */
export interface SiteChanges {
  /** What every page renders: site messages, the menu, social links, settings */
  readonly shared: readonly ChangeTime[];
  /** What only the landing renders: its images, media, the sections' rows, all collections and products */
  readonly landing: readonly ChangeTime[];
  /** Published collections (the collection pages), in the order of the sitemap */
  readonly collections: readonly CollectionPageChanges[];
}

export interface CollectionPageLastModified {
  readonly slug: string;
  readonly lastModified: Date;
}

/**
 * lastmod of the public pages (port of the frontend's toSitemapData): the latest change of the
 * rows a page renders. Every page renders the shared rows (header, footer, breadcrumbs, JSON-LD);
 * a collection page also its collection, cover, products and their images' media; the landing
 * also its own rows and every collection page's (it lists the collections), so the landing is
 * never older than a collection page. Hidden rows count too: hiding one bumps its updatedAt and
 * changes the pages (lastmod moves forward, never back).
 */
export class SitemapLastModified {
  constructor(private readonly changes: SiteChanges) {}

  /** Groups the latest change of every table by the pages that render it. */
  static of(content: ContentLastChanges, collections: readonly CollectionPageChanges[]): SitemapLastModified {
    const shared = [content.messages, content.menuItems, content.socialLinks, content.settings];
    const sections = [content.reviews, content.news, content.gallery, content.offers, content.partners];
    const catalog = [content.collections, content.products];
    const landing = [content.contentImages, content.media, ...sections, ...catalog];
    return new SitemapLastModified({ shared, landing, collections });
  }

  /** The landing's lastmod; null on an empty database. */
  findLanding(): Date | null {
    const pages = this.collectionPages().map(page => page.lastModified);
    return SitemapLastModified.latest([this.sharedLastModified(), ...this.changes.landing, ...pages]);
  }

  collectionPages(): CollectionPageLastModified[] {
    const shared = this.sharedLastModified();
    return this.changes.collections.map(page => ({ slug: page.slug, lastModified: this.lastModifiedOf(page, shared) }));
  }

  /** The latest of `times` (missing ones ignored); null when none is set. */
  static latest(times: readonly ChangeTime[]): Date | null {
    const known = times.filter((time): time is Date => time instanceof Date);
    return known.length === 0 ? null : new Date(Math.max(...known.map(time => time.getTime())));
  }

  private lastModifiedOf(page: CollectionPageChanges, shared: Date | null): Date {
    const own = [page.updatedAt, page.coverUpdatedAt, page.productsUpdatedAt, page.imagesUpdatedAt];
    return SitemapLastModified.latest([shared, ...own]) ?? page.updatedAt;
  }

  private sharedLastModified(): Date | null {
    return SitemapLastModified.latest(this.changes.shared);
  }
}
