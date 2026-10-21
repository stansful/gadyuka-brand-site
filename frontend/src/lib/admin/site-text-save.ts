import { isLocale, localeNames, type Locale } from '@/i18n/locales';
import type { SiteTextsConflictDetails } from '@shared/contracts/site-texts';

import type { FieldErrors } from './action-result';
import type { AdminTranslator } from './i18n';
import type { SiteTextLabels } from './site-texts';

/**
 * The refusal of a «Тексты сайта» save that met a conflict — pure, unit-tested.
 *
 * The editor sends only what the owner changed, each with the stored text it started from; the backend
 * checks under its lock that every edit still starts from what is stored and refuses the WHOLE save
 * (409, PUT /api/v1/admin/site-texts) when a text or image was changed in another tab or session
 * meanwhile, so a stale tab never puts an older text back over a newer one. Its `details` name them
 * (SiteTextsConflictDetails); this module turns them into the message and the field errors.
 */

/** A text changed elsewhere since the editor loaded it: what the row holds now. */
export type SiteTextConflict = { key: string; locale: Locale; current: string };

export type SiteTextConflicts = { texts: SiteTextConflict[]; images: string[] };

/** `details` of an error body as the API client passes them on (src/lib/api/api-result.ts). */
type ErrorDetails = SiteTextsConflictDetails | Readonly<Record<string, string | number | boolean>>;

/**
 * The conflicts of a 409's details, in their order: "<message key>.<locale>" → the stored text,
 * "<image key>" → true (SiteTextsConflictDetails). Anything else is ignored.
 */
export function parseSiteTextConflicts(details: ErrorDetails | undefined): SiteTextConflicts {
  const conflicts: SiteTextConflicts = { texts: [], images: [] };
  for (const [path, value] of Object.entries(details ?? {})) {
    if (value === true) {
      conflicts.images.push(path);
      continue;
    }
    const dot = path.lastIndexOf('.');
    const locale = path.slice(dot + 1);
    if (typeof value === 'string' && dot > 0 && isLocale(locale)) {
      conflicts.texts.push({ key: path.slice(0, dot), locale, current: value });
    }
  }
  return conflicts;
}

/** How many conflicting texts the message names (the rest are counted). */
const CONFLICTS_LISTED = 5;
/** Length of the stored text quoted in a conflict's field error. */
const CONFLICT_PREVIEW_LENGTH = 140;

function preview(text: string): string {
  return text.length > CONFLICT_PREVIEW_LENGTH ? `${text.slice(0, CONFLICT_PREVIEW_LENGTH)}…` : text;
}

/**
 * The refusal of a save with conflicts: the message names the texts and images changed elsewhere and
 * asks to reload; each of them gets a field error (a text quotes what is stored now, so the owner can
 * compare it with the edit before reloading).
 */
export function siteTextConflictFailure(
  conflicts: SiteTextConflicts,
  labels: SiteTextLabels,
  t: AdminTranslator<'admin.siteTexts.errors'>,
): { message: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const names: string[] = [];
  for (const conflict of conflicts.texts) {
    names.push(t('conflictText', { label: labels.text(conflict.key), language: localeNames[conflict.locale].short }));
    fieldErrors[`${conflict.key}.${conflict.locale}`] =
      conflict.current.trim() === ''
        ? t('conflictFieldEmpty')
        : t('conflictField', { current: preview(conflict.current) });
  }
  for (const key of conflicts.images) {
    names.push(t('conflictImage', { label: labels.image(key) }));
    fieldErrors[key] = t('conflictImageField');
  }
  const listed = names.slice(0, CONFLICTS_LISTED).join(', ');
  const rest = names.length - CONFLICTS_LISTED;
  const list = rest > 0 ? t('conflictMore', { texts: listed, count: rest }) : listed;
  return { message: t('conflict', { texts: list }), fieldErrors };
}
