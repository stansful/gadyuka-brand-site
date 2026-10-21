import { Injectable } from '@nestjs/common';

import type { LocalizedText } from '~shared/contracts/common';

import { SocialType } from '~core/socials/social-type';

import { SeedCopy } from '../copy/seed-copy';
import {
  DEMO_COLLECTION,
  DEMO_GALLERY,
  DEMO_MENU,
  DEMO_NEWS,
  DEMO_OFFERS,
  DEMO_PARTNER_NAMES,
  DEMO_PRODUCTS,
  DEMO_REVIEWS,
  DEMO_SETTINGS,
  DEMO_SOCIAL_LINKS,
  DemoOfferDefinition,
} from './demo-entities.constants';
import { SeedMediaKey } from './seed-media-key.enum';
import { SeedRowIds } from './seed-row-ids';

export interface DemoCollection {
  readonly slug: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly cover: SeedMediaKey;
  readonly order: number;
}

export interface DemoProduct {
  readonly slug: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly details: LocalizedText;
  readonly images: readonly SeedMediaKey[];
  readonly order: number;
}

export interface DemoReview {
  readonly id: string;
  /** Single-language column: the default-locale name */
  readonly author: string;
  readonly role: LocalizedText;
  readonly text: LocalizedText;
  readonly rating: number;
  readonly order: number;
}

export interface DemoNewsItem {
  readonly slug: string;
  readonly title: LocalizedText;
  readonly excerpt: LocalizedText;
  readonly body: LocalizedText;
  readonly date: Date;
  readonly image: SeedMediaKey;
}

export interface DemoGalleryItem {
  readonly id: string;
  readonly media: SeedMediaKey;
  readonly caption: LocalizedText;
  readonly order: number;
}

export interface DemoOffer {
  readonly id: string;
  readonly title: LocalizedText;
  readonly text: LocalizedText;
  readonly badge: LocalizedText;
  readonly ctaLabel: LocalizedText;
  readonly ctaHref: string;
  readonly validUntil: Date | null;
  readonly image: SeedMediaKey | null;
  readonly order: number;
}

export interface DemoPartner {
  readonly id: string;
  /** Single-language column: the default-locale name */
  readonly name: string;
  readonly description: LocalizedText;
  readonly order: number;
  readonly published: boolean;
}

export interface DemoMenuItem {
  readonly id: string;
  readonly label: LocalizedText;
  readonly href: string;
  readonly order: number;
}

export interface DemoSocialLink {
  readonly id: string;
  readonly type: SocialType;
  readonly label: LocalizedText;
  readonly url: string;
  readonly order: number;
  readonly published: boolean;
}

export interface DemoSettings {
  readonly phone: string;
  readonly email: string;
  readonly address: LocalizedText;
  readonly reviewRatingMax: number;
  readonly seoTitle: LocalizedText;
  readonly seoDescription: LocalizedText;
  readonly ogImage: SeedMediaKey;
}

/**
 * The demo entities with their texts: the definitions of demo-entities.constants.ts + the copy of
 * shared/messages/content (SeedCopy) + derived row ids (SeedRowIds). Pure: no database.
 */
@Injectable()
export class DemoEntityCatalog {
  private static readonly PARTNERS_PUBLISHED = false;

  constructor(
    private readonly copy: SeedCopy,
    private readonly ids: SeedRowIds,
  ) {}

  collection(): DemoCollection {
    const path = `collections.${DEMO_COLLECTION.slug}`;
    return {
      ...DEMO_COLLECTION,
      title: this.copy.localized(`${path}.title`),
      description: this.copy.localized(`${path}.description`),
    };
  }

  products(): DemoProduct[] {
    return DEMO_PRODUCTS.map(({ slug, images }, order) => ({
      slug,
      title: this.copy.localized(`products.${slug}.title`),
      description: this.copy.localized(`products.${slug}.description`),
      details: this.copy.localized(`products.${slug}.details`),
      images,
      order,
    }));
  }

  reviews(): DemoReview[] {
    return DEMO_REVIEWS.map(({ name, rating }, order) => ({
      id: this.ids.idOf(name),
      author: this.copy.defaultText(`reviews.${name}.author`),
      role: this.copy.localized(`reviews.${name}.role`),
      text: this.copy.localized(`reviews.${name}.text`),
      rating,
      order,
    }));
  }

  news(): DemoNewsItem[] {
    return DEMO_NEWS.map(({ slug, date, image }) => ({
      slug,
      title: this.copy.localized(`news.${slug}.title`),
      excerpt: this.copy.localized(`news.${slug}.excerpt`),
      body: this.copy.localized(`news.${slug}.body`),
      date: new Date(date),
      image,
    }));
  }

  gallery(): DemoGalleryItem[] {
    return DEMO_GALLERY.map(({ name, media }, order) => ({
      id: this.ids.idOf(name),
      media,
      caption: this.copy.localized(`gallery.${name}.caption`),
      order,
    }));
  }

  offers(): DemoOffer[] {
    return DEMO_OFFERS.map((offer, order) => this.toOffer(offer, order));
  }

  partners(): DemoPartner[] {
    return DEMO_PARTNER_NAMES.map((name, order) => ({
      id: this.ids.idOf(name),
      name: this.copy.defaultText(`partners.${name}.name`),
      description: this.copy.localized(`partners.${name}.description`),
      order,
      published: DemoEntityCatalog.PARTNERS_PUBLISHED,
    }));
  }

  menu(): DemoMenuItem[] {
    return DEMO_MENU.map(({ label, anchor }, order) => ({
      id: this.ids.idOf(`seed-menu-${label}`),
      label: this.copy.localized(`menu.${label}`),
      href: `#${anchor}`,
      order,
    }));
  }

  socialLinks(): DemoSocialLink[] {
    return DEMO_SOCIAL_LINKS.map(({ name, type, url, published }, order) => ({
      id: this.ids.idOf(name),
      type,
      label: {},
      url,
      order,
      published,
    }));
  }

  settings(): DemoSettings {
    return {
      ...DEMO_SETTINGS,
      address: this.copy.localized('settings.address'),
      seoTitle: this.copy.localized('settings.seoTitle'),
      seoDescription: this.copy.localized('settings.seoDescription'),
    };
  }

  /** Alt text of a seed image in every locale (`mediaAlt.<key>`). */
  mediaAlt(key: SeedMediaKey): LocalizedText {
    return this.copy.localized(`mediaAlt.${key}`);
  }

  private toOffer(offer: DemoOfferDefinition, order: number): DemoOffer {
    return {
      id: this.ids.idOf(offer.name),
      ...this.offerTextsOf(offer.name),
      ctaHref: offer.ctaHref,
      validUntil: offer.validUntil === null ? null : new Date(offer.validUntil),
      image: offer.image,
      order,
    };
  }

  private offerTextsOf(name: string): Pick<DemoOffer, 'title' | 'text' | 'badge' | 'ctaLabel'> {
    const path = `offers.${name}`;
    return {
      title: this.copy.localized(`${path}.title`),
      text: this.copy.localized(`${path}.text`),
      badge: this.copy.localized(`${path}.badge`),
      ctaLabel: this.copy.localized(`${path}.ctaLabel`),
    };
  }
}
