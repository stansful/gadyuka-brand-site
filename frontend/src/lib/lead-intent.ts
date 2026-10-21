import type { LeadType } from '@shared/contracts/leads';

/**
 * Lead types and lead intents (CTA → form) — ISOMORPHIC and dependency-free.
 *
 * Kept apart from src/lib/leads.ts on purpose: the layout-level SmoothScroll (every public page)
 * reads intents, and the lead validator in leads.ts is only needed where the form is.
 * leads.ts re-exports everything here.
 */

export const LEAD_TYPES = ['TAILORING', 'PARTNERSHIP', 'CONTACT'] as const satisfies ReadonlyArray<LeadType>;

export function isLeadType(value: unknown): value is LeadType {
  return typeof value === 'string' && (LEAD_TYPES as ReadonlyArray<string>).includes(value);
}

/** A CTA's request to the form: preselect `type`, show/prefill `subject` ("" = none). */
export type LeadIntent = { type: LeadType; subject: string };

/** window CustomEvent dispatched when an in-page CTA with data-lead-type is followed. */
export const LEAD_INTENT_EVENT = 'gadyuka:lead-intent';

/** Query parameters of cross-page CTA links: /?topic=CONTACT&subject=…#lead-form */
export const LEAD_INTENT_PARAMS = { type: 'topic', subject: 'subject' } as const;

export const LEAD_SUBJECT_MAX = 160;

/** Whitespace collapsed to single spaces, trimmed, at most LEAD_SUBJECT_MAX characters. */
function cleanSubject(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, LEAD_SUBJECT_MAX);
}

/** Validate an intent from untrusted input (DOM data attributes, URL, event detail). */
export function parseLeadIntent(value: unknown): LeadIntent | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const type: unknown = Reflect.get(value, 'type');
  if (!isLeadType(type)) return null;
  return { type, subject: cleanSubject(Reflect.get(value, 'subject')) };
}

/** Read an intent from URL search params (?topic=…&subject=…); null when absent/invalid. */
export function leadIntentFromSearch(search: string): LeadIntent | null {
  const params = new URLSearchParams(search);
  const type = params.get(LEAD_INTENT_PARAMS.type);
  if (type === null) return null;
  return parseLeadIntent({ type, subject: params.get(LEAD_INTENT_PARAMS.subject) ?? '' });
}

/** "/en" + intent + "lead-form" → "/en?topic=CONTACT&subject=Order%3A%20…#lead-form" */
export function leadIntentHref(path: string, intent: LeadIntent, anchor: string): string {
  const params = new URLSearchParams({ [LEAD_INTENT_PARAMS.type]: intent.type });
  if (intent.subject) params.set(LEAD_INTENT_PARAMS.subject, intent.subject);
  return `${path}?${params.toString()}#${anchor}`;
}

/**
 * The subject of a CTA from its message, e.g. catalog.orderSubject «Заказ: {product}» filled in
 * on the server → "Заказ: Худи «Знак»" — cleaned like an incoming intent (one line, at most
 * LEAD_SUBJECT_MAX characters). A blank message (emptied in the admin) falls back to `name`.
 */
export function leadSubject(subject: string, name = ''): string {
  return cleanSubject(subject) || cleanSubject(name);
}
