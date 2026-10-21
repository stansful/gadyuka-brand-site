import type { Locale } from '@/i18n/locales';
import type { TextKey } from '@/lib/content/registry';
import type { LeadType } from '@shared/contracts/leads';

export {
  LEAD_INTENT_EVENT,
  LEAD_INTENT_PARAMS,
  LEAD_SUBJECT_MAX,
  LEAD_TYPES,
  isLeadType,
  leadIntentFromSearch,
  leadIntentHref,
  leadSubject,
  parseLeadIntent,
  type LeadIntent,
} from './lead-intent';

/**
 * The lead form's configuration, error codes and API contract types — ISOMORPHIC and
 * dependency-free (types and constants only; the checks themselves are src/lib/leads.ts, which
 * re-exports everything here, so server code and the API keep importing "@/lib/leads").
 */

/** Field limits (shared by the validator, the form `maxLength` attributes and error messages). */
export const LEAD_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  phoneMax: 32,
  messageMax: 2000,
} as const;

/** Name of the honeypot input. Real users never see it; bots fill it in. */
export const LEAD_HONEYPOT_FIELD = 'hp';

// ─── Error codes ────────────────────────────────────────────────────────────

/** Error codes = keys of `forms.errors.*` in shared/messages/*.json. */
export type LeadErrorCode =
  | 'required'
  | 'invalidEmail'
  | 'invalidPhone'
  | 'contactRequired'
  | 'tooShort'
  | 'tooLong'
  | 'consentRequired'
  | 'invalidType'
  | 'invalid';

export const LEAD_SIMPLE_ERROR_CODES = [
  'required',
  'invalidEmail',
  'invalidPhone',
  'contactRequired',
  'consentRequired',
  'invalidType',
  'invalid',
] as const satisfies ReadonlyArray<LeadErrorCode>;

export type LeadSimpleErrorCode = (typeof LEAD_SIMPLE_ERROR_CODES)[number];

export type LeadFieldError =
  | { code: LeadSimpleErrorCode }
  | { code: 'tooShort'; min: number }
  | { code: 'tooLong'; max: number };

/** Fields that can carry an error. `contact` = "email or phone" group error. */
export const LEAD_ERROR_FIELDS = ['type', 'name', 'email', 'phone', 'message', 'consent', 'contact'] as const;
export type LeadErrorField = (typeof LEAD_ERROR_FIELDS)[number];

export type LeadFieldErrors = Partial<Record<LeadErrorField, LeadFieldError>>;

// ─── Form configuration ─────────────────────────────────────────────────────

export type LeadInputField = 'name' | 'email' | 'phone' | 'message';

export type LeadFieldConfig = { name: LeadInputField; required: boolean };

/**
 * Visible fields per form type, in display order.
 * `required` drives the asterisk / `required` attribute; for TAILORING / PARTNERSHIP
 * email and phone are individually optional but one of them is needed (group error `contact`).
 */
export const LEAD_FORM_FIELDS: Readonly<Record<LeadType, ReadonlyArray<LeadFieldConfig>>> = {
  TAILORING: [
    { name: 'name', required: true },
    { name: 'phone', required: false },
    { name: 'email', required: false },
    { name: 'message', required: false },
  ],
  PARTNERSHIP: [
    { name: 'name', required: true },
    { name: 'email', required: false },
    { name: 'phone', required: false },
    { name: 'message', required: false },
  ],
  CONTACT: [
    { name: 'email', required: true },
    { name: 'name', required: true },
    { name: 'message', required: false },
  ],
};

/** True when the form shows the "email or phone" hint/group error. */
export function needsEmailOrPhone(type: LeadType): boolean {
  return type !== 'CONTACT';
}

// ─── The contact form («Письмо в редакцию») ──────────────────────────────────
//
// The site has ONE lead form (contacts section). Its «Тема» selector picks the lead type;
// CTA buttons elsewhere on the site preselect the topic (and prefill a subject) via a
// LeadIntent: data-lead-type / data-lead-subject on in-page links, or ?topic=…&subject=…
// on links from other pages (e.g. the collection page).

/** Topics of the form selector, in display order (message key of the option label). */
export const LEAD_TOPICS: ReadonlyArray<{ type: LeadType; key: TextKey }> = [
  { type: 'TAILORING', key: 'contacts.form.topics.tailoring' },
  { type: 'PARTNERSHIP', key: 'contacts.form.topics.partnership' },
  { type: 'CONTACT', key: 'contacts.form.topics.contact' },
];

/** Topic selected when nothing preselected it. */
export const DEFAULT_LEAD_TYPE: LeadType = 'CONTACT';

/** Display order of the inputs (as in the design: e-mail, name, …). */
export const LEAD_FIELD_ORDER: ReadonlyArray<LeadInputField> = ['email', 'name', 'phone', 'message'];

/**
 * Inputs shown for a topic, in display order. Which fields exist and which are required
 * comes from LEAD_FORM_FIELDS (the same rules the API validates); only the order is fixed,
 * so switching the topic never reshuffles the form (the phone field appears for tailoring /
 * partnership, where "e-mail or phone" is enough).
 */
export function leadFieldsFor(type: LeadType): LeadFieldConfig[] {
  const byName = new Map(LEAD_FORM_FIELDS[type].map(field => [field.name, field]));
  return LEAD_FIELD_ORDER.flatMap(name => {
    const field = byName.get(name);
    return field ? [field] : [];
  });
}

/**
 * Copy of the contact form: the site messages contacts.form.*, resolved on the server
 * (src/components/site/lead-form-copy.ts — labels, topics, consent, button and success notice
 * are never empty there). The form's system texts (errors, «Отправляем…») are messages forms.*.
 */
export type LeadFormCopy = {
  topicLabel: string;
  topics: Record<LeadType, string>;
  /** «По поводу: {subject}» — the topic preselected by a CTA ("" = the subject alone). */
  subjectLine: string;
  labels: Record<LeadInputField, string>;
  /** "" = no placeholder. */
  placeholders: Record<LeadInputField, string>;
  consent: string;
  submit: string;
  success: string;
};

// ─── Plain HTML form posts (no JS yet / no JS at all) ───────────────────────

/**
 * Without JS (or when the visitor submits before hydration) the form posts itself as
 * application/x-www-form-urlencoded to POST /api/leads, which answers with a 303 back to the
 * landing at one of these anchors; the matching notice in the form is shown by CSS :target.
 */
export const LEAD_RESULT_ANCHORS = { sent: 'lead-sent', invalid: 'lead-invalid', failed: 'lead-failed' } as const;

export type LeadResult = keyof typeof LEAD_RESULT_ANCHORS;

// ─── API contract (POST /api/leads) ─────────────────────────────────────────

/** Request body of POST /api/leads (Content-Type: application/json). */
export type LeadRequestBody = {
  type: LeadType;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  locale: Locale;
  consent: boolean;
  /** Honeypot — always send "" */
  hp?: string;
};

export type LeadApiErrorCode =
  | 'invalid_form'
  | 'bad_request'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'rate_limited'
  | 'server_error';

/** 201 */
export type LeadApiSuccess = { ok: true; id: string };

/** 400 / 413 / 415 / 422 / 429 / 500 — `message` and `fieldErrors` are localized strings. */
export type LeadApiFailure = {
  ok: false;
  error: LeadApiErrorCode;
  message: string;
  fieldErrors?: Partial<Record<LeadErrorField, string>>;
  /** Seconds (429 only; also sent as the Retry-After header) */
  retryAfter?: number;
};

export type LeadApiResponse = LeadApiSuccess | LeadApiFailure;
