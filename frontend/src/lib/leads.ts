import { defaultLocale, toLocale, type Locale } from '@/i18n/locales';
import type { LeadType } from '@shared/contracts/leads';

import {
  LEAD_ERROR_FIELDS,
  LEAD_HONEYPOT_FIELD,
  LEAD_LIMITS,
  isLeadType,
  type LeadApiErrorCode,
  type LeadApiFailure,
  type LeadApiResponse,
  type LeadErrorField,
  type LeadFieldError,
  type LeadFieldErrors,
} from './lead-form-config';

export * from './lead-form-config';

/**
 * Lead (заявка) validation and API contract — ISOMORPHIC and dependency-free (no zod: the
 * validator is a few hand-written checks, ~1 KB gzipped, so the form ships it with its own code).
 *
 * Used by:
 *  - <LeadForm/> (src/components/site/LeadForm.tsx) — inline validation and the check of the API's
 *    answer (parseLeadApiResponse). The authoritative checks are the backend's (POST
 *    /api/v1/public/leads, backend/src/usecases/public/leads): the same rules, codes and limits —
 *    change both together;
 *  - POST /api/leads (src/app/api/leads/route.ts) — the body limit, the no-JS form parsing and the
 *    answer's locale;
 *  - CTA links that open the form with a preselected topic (LeadIntent — ./lead-intent.ts,
 *    re-exported here through ./lead-form-config.ts).
 *
 * The limits, field configuration, error codes and API types live in ./lead-form-config.ts and
 * are re-exported here, so server code and the API keep importing "@/lib/leads".
 *
 * No server-only imports here (storage, rate limits and Telegram are the backend's).
 */

/** Max size of the JSON body accepted by POST /api/leads. */
export const LEAD_MAX_BODY_BYTES = 16 * 1024;

/** A plain object (not null, not an array) — what a JSON object parses to. */
function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLeadErrorField(value: string): value is LeadErrorField {
  return (LEAD_ERROR_FIELDS as ReadonlyArray<string>).includes(value);
}

// ─── Normalization helpers ──────────────────────────────────────────────────

const PHONE_ALLOWED = /^\+?[\d\s().-]+$/;

/**
 * Normalize a phone number to E.164-like "+<digits>" (10–15 digits).
 * Russian conveniences: "8 (900) 123-45-67" → "+79001234567", "900 123 45 67" → "+79001234567".
 * Returns null when the value cannot be a phone number.
 */
export function normalizePhone(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0 || value.length > LEAD_LIMITS.phoneMax || !PHONE_ALLOWED.test(value)) return null;
  const hasPlus = value.startsWith('+');
  let digits = value.replace(/\D/g, '');
  if (!hasPlus) {
    if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    else if (digits.length === 10 && digits.startsWith('9')) digits = `7${digits}`;
  }
  if (digits.length < 10 || digits.length > 15 || digits.startsWith('0')) return null;
  return `+${digits}`;
}

/**
 * The e-mail pattern the form has always accepted (the backend checks the same one): dot-separated
 * local part of letters, digits and _'+-, a domain of letter/digit labels, an alphabetic TLD of 2+
 * letters.
 */
const EMAIL_PATTERN = /^(?:[\w'+-]+\.)*[\w'+-]*[\w+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

/** "", "   ", null and undefined count as "not provided". */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0);
}

// ─── Field checks ───────────────────────────────────────────────────────────
// Each returns the normalized value, or the error of the first check that failed.

type Checked<T> = { value: T; error?: undefined } | { value?: undefined; error: LeadFieldError };

const fail = (error: LeadFieldError): { error: LeadFieldError } => ({ error });

function checkName(raw: unknown): Checked<string> {
  if (typeof raw !== 'string') return fail({ code: 'required' });
  const value = raw.trim();
  if (value.length === 0) return fail({ code: 'required' });
  if (value.length < LEAD_LIMITS.nameMin) return fail({ code: 'tooShort', min: LEAD_LIMITS.nameMin });
  if (value.length > LEAD_LIMITS.nameMax) return fail({ code: 'tooLong', max: LEAD_LIMITS.nameMax });
  return { value };
}

/** E-mail: optional (TAILORING / PARTNERSHIP) or required (CONTACT — then a missing or non-text value is "required"). */
function checkEmail(raw: unknown, required: boolean): Checked<string | null> {
  if (isBlank(raw)) return required ? fail({ code: 'required' }) : { value: null };
  if (typeof raw !== 'string') return fail({ code: required ? 'required' : 'invalidEmail' });
  const value = raw.trim();
  if (value.length > LEAD_LIMITS.emailMax) return fail({ code: 'tooLong', max: LEAD_LIMITS.emailMax });
  if (!EMAIL_PATTERN.test(value)) return fail({ code: 'invalidEmail' });
  return { value };
}

function checkPhone(raw: unknown): Checked<string | null> {
  if (isBlank(raw)) return { value: null };
  if (typeof raw !== 'string') return fail({ code: 'invalidPhone' });
  const value = raw.trim();
  if (value.length > LEAD_LIMITS.phoneMax) return fail({ code: 'tooLong', max: LEAD_LIMITS.phoneMax });
  const phone = normalizePhone(value);
  return phone === null ? fail({ code: 'invalidPhone' }) : { value: phone };
}

function checkMessage(raw: unknown): Checked<string> {
  if (raw === null || raw === undefined) return { value: '' };
  if (typeof raw !== 'string') return fail({ code: 'invalid' });
  const value = raw.trim();
  if (value.length > LEAD_LIMITS.messageMax) return fail({ code: 'tooLong', max: LEAD_LIMITS.messageMax });
  return { value };
}

// ─── Validation ─────────────────────────────────────────────────────────────

/** A validated, normalized lead ready to be stored. */
export type LeadSubmission = {
  type: LeadType;
  name: string;
  /** null when not provided */
  email: string | null;
  /** E.164-like "+79001234567"; null when not provided */
  phone: string | null;
  /** "" when not provided */
  message: string;
  locale: Locale;
};

export type LeadValidationResult =
  | { ok: true; data: LeadSubmission }
  | { ok: false; reason: 'honeypot' }
  | { ok: false; reason: 'invalid'; errors: LeadFieldErrors };

/** True when the raw payload has a non-empty honeypot value (any type). */
function honeypotFilled(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) return false;
  const value: unknown = Reflect.get(input, LEAD_HONEYPOT_FIELD);
  if (value === undefined || value === null) return false;
  return typeof value !== 'string' || value.length > 0;
}

/**
 * Validate a raw lead payload (parsed JSON or form state):
 *  - honeypot filled → `{ ok: false, reason: "honeypot" }` (the API pretends success);
 *  - otherwise every field is checked and the first error of each is reported:
 *    - type: TAILORING | PARTNERSHIP | CONTACT (`invalidType` for anything else / a non-object);
 *    - name: 2–80 characters after trimming;
 *    - TAILORING / PARTNERSHIP: e-mail and phone optional, but one of them is needed (group error
 *      `contact` — only when both are empty: a typed but invalid one has its own error);
 *    - CONTACT: e-mail required, phone optional;
 *    - message: optional, ≤ 2000 characters; consent must be `true`; locale falls back to ru.
 */
export function validateLeadInput(input: unknown): LeadValidationResult {
  if (honeypotFilled(input)) return { ok: false, reason: 'honeypot' };
  const type: unknown = isRecord(input) ? Reflect.get(input, 'type') : undefined;
  if (!isRecord(input) || !isLeadType(type)) {
    return { ok: false, reason: 'invalid', errors: { type: { code: 'invalidType' } } };
  }
  const field = (name: string): unknown => Reflect.get(input, name);

  const name = checkName(field('name'));
  const email = checkEmail(field('email'), type === 'CONTACT');
  const phone = checkPhone(field('phone'));
  const message = checkMessage(field('message'));

  // Error keys in the order of the form's fields; `type` carries a malformed honeypot (null).
  const errors: LeadFieldErrors = {};
  if (name.error) errors.name = name.error;
  if (email.error) errors.email = email.error;
  if (phone.error) errors.phone = phone.error;
  if (message.error) errors.message = message.error;
  if (field('consent') !== true) errors.consent = { code: 'consentRequired' };
  const honeypot = field(LEAD_HONEYPOT_FIELD);
  if (honeypot !== undefined && typeof honeypot !== 'string') errors.type = { code: 'invalid' };
  if (type !== 'CONTACT' && isBlank(field('email')) && isBlank(field('phone'))) {
    errors.contact = { code: 'contactRequired' };
  }

  if (
    Object.keys(errors).length > 0 ||
    name.value === undefined ||
    email.value === undefined ||
    phone.value === undefined ||
    message.value === undefined
  ) {
    return { ok: false, reason: 'invalid', errors };
  }
  return {
    ok: true,
    data: {
      type,
      name: name.value,
      email: email.value,
      phone: phone.value,
      message: message.value,
      locale: toLocale(field('locale')),
    },
  };
}

/** Locale of a raw payload (for localized API errors), falling back to ru. */
export function leadLocaleOf(input: unknown): Locale {
  if (typeof input !== 'object' || input === null) return defaultLocale;
  return toLocale(Reflect.get(input, 'locale'));
}

// ─── Plain HTML form posts (no JS yet / no JS at all) ───────────────────────

/** A urlencoded form body → the raw payload validateLeadInput() expects (checkbox "on" → true). */
export function leadInputFromForm(params: URLSearchParams): Record<string, unknown> {
  const text = (name: string): string | undefined => params.get(name) ?? undefined;
  const consent = params.get('consent');
  return {
    type: text('type'),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    message: text('message'),
    locale: text('locale'),
    consent: consent === 'on' || consent === 'true',
    [LEAD_HONEYPOT_FIELD]: text(LEAD_HONEYPOT_FIELD),
  };
}

// ─── API contract (POST /api/leads) ─────────────────────────────────────────

const API_ERROR_CODES = [
  'invalid_form',
  'bad_request',
  'unsupported_media_type',
  'payload_too_large',
  'rate_limited',
  'server_error',
] as const satisfies ReadonlyArray<LeadApiErrorCode>;

function isApiErrorCode(value: unknown): value is LeadApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as ReadonlyArray<string>).includes(value);
}

/** `fieldErrors` of a failure: only known fields, each a (localized) string; null when malformed. */
function parseFieldErrors(value: unknown): Partial<Record<LeadErrorField, string>> | null {
  if (!isRecord(value)) return null;
  const out: Partial<Record<LeadErrorField, string>> = {};
  for (const [key, message] of Object.entries(value)) {
    if (!isLeadErrorField(key) || typeof message !== 'string') return null;
    out[key] = message;
  }
  return out;
}

/**
 * The API's answer (the form checks what it receives): a LeadApiResponse with only the known
 * properties, or null when the body is not one (then the form shows its generic server error).
 */
export function parseLeadApiResponse(value: unknown): LeadApiResponse | null {
  if (!isRecord(value)) return null;
  const ok: unknown = Reflect.get(value, 'ok');
  if (ok === true) {
    const id: unknown = Reflect.get(value, 'id');
    return typeof id === 'string' ? { ok: true, id } : null;
  }
  if (ok !== false) return null;
  const error: unknown = Reflect.get(value, 'error');
  const message: unknown = Reflect.get(value, 'message');
  if (!isApiErrorCode(error) || typeof message !== 'string') return null;
  const failure: LeadApiFailure = { ok: false, error, message };
  const fieldErrors: unknown = Reflect.get(value, 'fieldErrors');
  if (fieldErrors !== undefined) {
    const parsed = parseFieldErrors(fieldErrors);
    if (!parsed) return null;
    failure.fieldErrors = parsed;
  }
  const retryAfter: unknown = Reflect.get(value, 'retryAfter');
  if (retryAfter !== undefined) {
    if (typeof retryAfter !== 'number' || !Number.isFinite(retryAfter)) return null;
    failure.retryAfter = retryAfter;
  }
  return failure;
}
