import { MAX_REORDER_IDS } from '~core/entities/entity-order.constants';

/**
 * Limits of the admin content entities (port of the frontend's admin zod schemas): lengths are
 * characters of one translation / of the trimmed value.
 */

/** http(s) links (partners, social links); links of the site: SiteHref.MAX_LENGTH (~core/links/site-href). */
export const HTTP_URL_MAX_LENGTH = 500;

export const NEWS_LIMITS = { TITLE: 200, EXCERPT: 1000, BODY: 20_000 } as const;
export const GALLERY_LIMITS = { CAPTION: 300, BULK_MIN_ITEMS: 1, BULK_MAX_ITEMS: 100 } as const;
export const OFFER_LIMITS = { TITLE: 200, TEXT: 3000, BADGE: 40, CTA_LABEL: 60 } as const;
export const PARTNER_LIMITS = { NAME: 120, DESCRIPTION: 3000 } as const;
export const MENU_ITEM_LIMITS = { LABEL: 80 } as const;
export const SOCIAL_LINK_LIMITS = { LABEL: 60 } as const;

/**
 * Most rows an admin list answers with. The lists are not paginated: they are reordered by drag and
 * drop as a whole (the reorder request takes at most 1000 ids too) and stay far shorter.
 */
export const MAX_ADMIN_LIST_ROWS = MAX_REORDER_IDS;
