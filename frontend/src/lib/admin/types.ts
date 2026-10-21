import type { Locale } from '@/i18n/locales';
import type { MediaRef } from '@shared/contracts/common';

/**
 * The row of the generic admin list (src/components/admin/lists/EntityList.tsx) — isomorphic. Each
 * admin area builds its rows from the backend's list response (queries/catalog.ts, queries/content.ts);
 * the other view models live next to their area (catalog-view.ts, content-entities.ts, site-texts.ts,
 * components/admin/media/media-types.ts).
 */
export type EntityRow = {
  id: string;
  title: string;
  subtitle?: string;
  thumb: MediaRef | null;
  href: string;
  published: boolean;
  /** Locales whose main text is not translated yet. */
  missingLocales: Locale[];
  /** Small grey note (e.g. «4 товара», «до 31.10.2026»). */
  meta?: string;
  /** Extra confirmation text shown before deleting. */
  deleteWarning?: string;
};
