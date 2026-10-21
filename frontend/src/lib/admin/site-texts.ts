import { isImageKey, isSectionId, SECTION_ANCHORS } from '@/lib/content/registry';
import type {
  SiteImageEntry as SiteImageEntryContract,
  SiteTextEntry as SiteTextEntryContract,
  SiteTextSectionSummary as SiteTextSectionSummaryContract,
  SiteTextsPageResponse,
} from '@shared/contracts/site-texts';

import type { AdminTranslator } from './i18n';

/**
 * «Тексты сайта» — the admin's view of the site texts (pure, unit-tested). The backend owns the texts,
 * their rules and the search (GET /api/v1/admin/site-texts, shared/contracts/site-texts.ts); this module
 * adds what only the admin shows: the Russian names of sections, texts and landing images
 * (admin.siteTexts.sections / labels / images in shared/messages/admin/ru.json) and the landing anchor
 * of a section («Посмотреть на сайте»).
 *
 * Message.editedAt is the «изменено» marker: absent = the default of shared/messages/<locale>.json,
 * set = edited in the admin (a value saved equal to the default, or «Вернуть по умолчанию», clears it).
 */

// ── labels ────────────────────────────────────────────────────────────────────

/** Russian admin names of the sections, texts and landing images. */
export type SiteTextLabels = {
  /** A section the admin copy does not name yet is listed under its id. */
  section: (id: string) => string;
  /** A text without a label is listed under its key without the namespace ("advantages.0.title"). */
  text: (key: string) => string;
  /** An image the admin copy does not know is listed under its key. */
  image: (key: string) => string;
};

type SiteTextsTranslator = AdminTranslator<'admin.siteTexts'>;
type SiteTextsMessageKey = Parameters<SiteTextsTranslator>[0];

export function siteTextLabels(t: SiteTextsTranslator): SiteTextLabels {
  return {
    // Typed per section id: a section of the registry without admin.siteTexts.sections.<id> fails tsc.
    section: id => (isSectionId(id) ? t(`sections.${id}`) : id),
    text: key => {
      // Labels are optional; t.has is the runtime check, the cast only lets it ask.
      const path = `labels.${key}` as SiteTextsMessageKey;
      return t.has(path) ? t(path) : key.slice(key.indexOf('.') + 1);
    },
    image: key => (isImageKey(key) ? t(`images.${key}`) : key),
  };
}

// ── page ──────────────────────────────────────────────────────────────────────

/** Max length of the «Тексты сайта» search query (the backend cuts a longer one the same way). */
export const SITE_TEXT_QUERY_MAX_LENGTH = 100;

function hasOwn<T extends object>(record: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/** In-page anchor of a section on the landing ("hero" → "home"); null when it has none. */
export function siteTextSectionAnchor(section: string): string | null {
  return hasOwn(SECTION_ANCHORS, section) ? SECTION_ANCHORS[section] : null;
}

/** One site text in the editor: the backend's entry with its admin name. */
export type SiteTextEntry = SiteTextEntryContract & { readonly label: string };

/** A landing image edited next to the texts of its section. */
export type SiteImageEntry = SiteImageEntryContract & { readonly label: string };

/** A group of texts in the editor: one section, or the matches of a search in one section. */
export type SiteTextGroup = {
  /** Section id = top-level namespace of the messages ("hero", "forms", …). */
  readonly section: string;
  readonly label: string;
  /** In-page anchor of the section on the landing (null when not on the landing). */
  readonly anchor: string | null;
  readonly entries: readonly SiteTextEntry[];
  readonly images: readonly SiteImageEntry[];
};

/** Tab of the «Тексты сайта» section bar. */
export type SiteTextSectionSummary = SiteTextSectionSummaryContract & { readonly label: string };

export type SiteTextsPageData = {
  readonly sections: readonly SiteTextSectionSummary[];
  /** "section" = one section with its images; "search" = matches of `query` across sections. */
  readonly mode: SiteTextsPageResponse['mode'];
  /** Active section in "section" mode. */
  readonly section: string | null;
  /** Normalized search query in "search" mode. */
  readonly query: string;
  readonly groups: readonly SiteTextGroup[];
};

/** The backend's page with the admin names and landing anchors. */
export function toSiteTextsPageData(page: SiteTextsPageResponse, labels: SiteTextLabels): SiteTextsPageData {
  return {
    sections: page.sections.map(section => ({ ...section, label: labels.section(section.id) })),
    mode: page.mode,
    section: page.section,
    query: page.query,
    groups: page.groups.map(group => ({
      section: group.section,
      label: labels.section(group.section),
      anchor: siteTextSectionAnchor(group.section),
      entries: group.entries.map(entry => ({ ...entry, label: labels.text(entry.key) })),
      images: group.images.map(image => ({ ...image, label: labels.image(image.key) })),
    })),
  };
}
