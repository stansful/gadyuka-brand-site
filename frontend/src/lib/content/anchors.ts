import type { SectionId } from './registry';

/**
 * In-page anchors of the landing — ISOMORPHIC and tiny. Client components (the layout-level
 * SmoothScroll, the language switcher) import this module instead of ./registry, which also
 * carries the admin metadata of every message. ./registry re-exports both constants.
 */

/**
 * Landing section → in-page anchor (`<section id>`), null for header/footer/common. Admin
 * sections that are not on the landing (forms, notFound, …) have no entry.
 */
export const SECTION_ANCHORS = {
  header: null,
  hero: 'home',
  catalog: 'catalog',
  about: 'about',
  tailoring: 'tailoring',
  reviews: 'reviews',
  news: 'news',
  gallery: 'gallery',
  offers: 'offers',
  partners: 'partners',
  contacts: 'contacts',
  footer: null,
  common: null,
} as const satisfies Partial<Record<SectionId, string | null>>;

/** In-page anchor of the lead form («Письмо в редакцию», inside the contacts section). */
export const LEAD_FORM_ANCHOR = 'lead-form';
