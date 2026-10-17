import type { SectionId } from "./registry";

/**
 * In-page anchors of the landing — ISOMORPHIC and tiny. Client components (the layout-level
 * SmoothScroll, the language switcher) import this module instead of ./registry, which also
 * carries every admin label of CONTENT_BLOCKS. ./registry re-exports both constants.
 */

/** id → in-page anchor (`<section id>`), null for header/footer/common. */
export const SECTION_ANCHORS = {
  header: null,
  hero: "home",
  catalog: "catalog",
  about: "about",
  tailoring: "tailoring",
  reviews: "reviews",
  news: "news",
  gallery: "gallery",
  offers: "offers",
  partners: "partners",
  contacts: "contacts",
  footer: null,
  common: null,
} as const satisfies Record<SectionId, string | null>;

/** In-page anchor of the lead form («Письмо в редакцию», inside the contacts section). */
export const LEAD_FORM_ANCHOR = "lead-form";
