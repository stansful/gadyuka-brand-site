import { Injectable } from '@nestjs/common';

import { PUBLIC_LIST_LIMITS } from '~core/public-content/public-content.constants';
import { SocialType } from '~core/socials/social-type';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { MANUAL_ORDER, PUBLIC_MEDIA_SELECT, PublicMediaRow } from '~usecases/public/content/common/public-media.select';

const MEDIA = { select: PUBLIC_MEDIA_SELECT } as const;

const REVIEW_SELECT = {
  id: true,
  author: true,
  role: true,
  text: true,
  rating: true,
  avatar: MEDIA,
} satisfies Prisma.ReviewSelect;
const NEWS_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  date: true,
  image: MEDIA,
} satisfies Prisma.NewsItemSelect;
const OFFER_SELECT = {
  id: true,
  title: true,
  text: true,
  badge: true,
  ctaLabel: true,
  ctaHref: true,
  validUntil: true,
  image: MEDIA,
} satisfies Prisma.OfferSelect;
const PARTNER_SELECT = {
  id: true,
  name: true,
  url: true,
  description: true,
  logo: MEDIA,
} satisfies Prisma.PartnerSelect;
const MENU_SELECT = {
  id: true,
  label: true,
  href: true,
  showInHeader: true,
  showInFooter: true,
} satisfies Prisma.MenuItemSelect;

/** Reviews: the admin's order; on ties the NEWER review first. */
const REVIEW_ORDER: Prisma.ReviewOrderByWithRelationInput[] = [{ order: 'asc' }, { createdAt: 'desc' }];
/** News: the newest date first (ties: the newer row first). */
const NEWS_ORDER: Prisma.NewsItemOrderByWithRelationInput[] = [{ date: 'desc' }, { createdAt: 'desc' }];

/** LocalizedText fields are the stored JSON (`unknown`); the presenter reads them for the locale. */
export interface ContentImageRow {
  readonly key: string;
  readonly media: PublicMediaRow | null;
}

export interface MenuItemRow {
  readonly id: string;
  readonly label: unknown;
  readonly href: string;
  readonly showInHeader: boolean;
  readonly showInFooter: boolean;
}

export interface SocialLinkRow {
  readonly id: string;
  readonly type: SocialType;
  readonly label: unknown;
  readonly url: string;
}

export interface ReviewRow {
  readonly id: string;
  readonly author: string;
  readonly role: unknown;
  readonly text: unknown;
  readonly rating: number | null;
  readonly avatar: PublicMediaRow | null;
}

export interface NewsItemRow {
  readonly id: string;
  readonly slug: string;
  readonly title: unknown;
  readonly excerpt: unknown;
  readonly body: unknown;
  readonly date: Date;
  readonly image: PublicMediaRow | null;
}

export interface GalleryItemRow {
  readonly id: string;
  readonly caption: unknown;
  readonly media: PublicMediaRow | null;
}

export interface OfferRow {
  readonly id: string;
  readonly title: unknown;
  readonly text: unknown;
  readonly badge: unknown;
  readonly ctaLabel: unknown;
  readonly ctaHref: string | null;
  readonly validUntil: Date | null;
  readonly image: PublicMediaRow | null;
}

export interface PartnerRow {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly description: unknown;
  readonly logo: PublicMediaRow | null;
}

/** The page frame of the landing: its images, the menu, the social links. */
export interface LandingFrameRows {
  readonly images: readonly ContentImageRow[];
  readonly menu: readonly MenuItemRow[];
  readonly socials: readonly SocialLinkRow[];
}

/** The entity sections of the landing (the catalog is read by PublishedCollectionsRepository). */
export interface LandingSectionRows {
  readonly reviews: readonly ReviewRow[];
  readonly news: readonly NewsItemRow[];
  readonly gallery: readonly GalleryItemRow[];
  readonly offers: readonly OfferRow[];
  readonly partners: readonly PartnerRow[];
}

/** The published rows of the landing (port of the frontend's getLanding queries): explicit selects, bounded. */
@Injectable()
export class LandingRepository {
  constructor(private readonly database: DatabaseService) {}

  async findFrame(): Promise<LandingFrameRows> {
    const [images, menu, socials] = await Promise.all([this.findImages(), this.findMenu(), this.findSocials()]);
    return { images, menu, socials };
  }

  /** `now`: offers whose validUntil is before it are over and not listed. */
  async findSections(now: Date): Promise<LandingSectionRows> {
    const [reviews, news, gallery, offers, partners] = await Promise.all([
      this.findReviews(),
      this.findNews(),
      this.findGallery(),
      this.findOffers(now),
      this.findPartners(),
    ]);
    return { reviews, news, gallery, offers, partners };
  }

  private findImages(): Promise<ContentImageRow[]> {
    return this.database.client.contentImage.findMany({
      orderBy: { key: 'asc' },
      take: PUBLIC_LIST_LIMITS.contentImages,
      select: { key: true, media: MEDIA },
    });
  }

  private findMenu(): Promise<MenuItemRow[]> {
    return this.database.client.menuItem.findMany({
      where: { published: true },
      orderBy: MANUAL_ORDER,
      take: PUBLIC_LIST_LIMITS.menu,
      select: MENU_SELECT,
    });
  }

  private findSocials(): Promise<SocialLinkRow[]> {
    return this.database.client.socialLink.findMany({
      where: { published: true },
      orderBy: MANUAL_ORDER,
      take: PUBLIC_LIST_LIMITS.socials,
      select: { id: true, type: true, label: true, url: true },
    });
  }

  private findReviews(): Promise<ReviewRow[]> {
    return this.database.client.review.findMany({
      where: { published: true },
      orderBy: REVIEW_ORDER,
      take: PUBLIC_LIST_LIMITS.reviews,
      select: REVIEW_SELECT,
    });
  }

  private findNews(): Promise<NewsItemRow[]> {
    return this.database.client.newsItem.findMany({
      where: { published: true },
      orderBy: NEWS_ORDER,
      take: PUBLIC_LIST_LIMITS.news,
      select: NEWS_SELECT,
    });
  }

  private findGallery(): Promise<GalleryItemRow[]> {
    return this.database.client.galleryItem.findMany({
      where: { published: true },
      orderBy: MANUAL_ORDER,
      take: PUBLIC_LIST_LIMITS.gallery,
      select: { id: true, caption: true, media: MEDIA },
    });
  }

  private findOffers(now: Date): Promise<OfferRow[]> {
    return this.database.client.offer.findMany({
      where: { published: true, OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      orderBy: MANUAL_ORDER,
      take: PUBLIC_LIST_LIMITS.offers,
      select: OFFER_SELECT,
    });
  }

  private findPartners(): Promise<PartnerRow[]> {
    return this.database.client.partner.findMany({
      where: { published: true },
      orderBy: MANUAL_ORDER,
      take: PUBLIC_LIST_LIMITS.partners,
      select: PARTNER_SELECT,
    });
  }
}
