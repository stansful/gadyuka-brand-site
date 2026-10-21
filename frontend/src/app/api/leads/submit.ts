import 'server-only';
import { describeFailure, type ApiFailure } from '@/lib/api/api-result';
import type { VisitorInfo } from '@/lib/api/client';
import { submitLead } from '@/lib/api/leads';
import {
  LEAD_ERROR_FIELDS,
  LEAD_SIMPLE_ERROR_CODES,
  type LeadFieldError,
  type LeadFieldErrors,
  type LeadSimpleErrorCode,
} from '@/lib/leads';
import type { MessageRef } from '@shared/contracts/errors';
import type { LeadSubmitPayload, LeadSubmitRequest } from '@shared/contracts/leads';

/**
 * The lead submission of POST /api/leads without HTTP details: the visitor's form → the backend
 * (POST /api/v1/public/leads — validation, honeypot, rate limits, storage, the Telegram notification;
 * shared/contracts/leads.ts) → an outcome the route answers with.
 *
 * Only the form's own fields are forwarded, with their values exactly as received (the backend checks
 * their types too); the visitor's IP and user agent travel as headers (getVisitor), the page's Referer
 * in the body (Lead.meta). A honeypot hit comes back as an ordinary 201 with a decoy id.
 */

export type SubmitLeadContext = {
  visitor: VisitorInfo;
  /** Referer header of the visitor's request (null when absent) */
  referer: string | null;
};

export type SubmitLeadOutcome =
  | { status: 'created'; id: string }
  | { status: 'invalid'; errors: LeadFieldErrors }
  | { status: 'rate_limited'; retryAfterSeconds: number }
  | { status: 'failed'; reason: string };

/** The form fields forwarded to the backend (LeadSubmitRequest without the server-side referer). */
const FORM_FIELDS = [
  'type',
  'name',
  'email',
  'phone',
  'message',
  'locale',
  'consent',
  'hp',
] as const satisfies ReadonlyArray<keyof LeadSubmitRequest>;

/** Namespace of the backend's lead form errors: site messages forms.errors.<code>. */
const FORM_ERRORS_NAMESPACE = 'forms.errors';
const FORM_ERROR_PREFIX = `${FORM_ERRORS_NAMESPACE}.`;

/** Retry-After when a 429 of the backend does not say (the per-network window, 10 minutes). */
const DEFAULT_RETRY_AFTER_SECONDS = 600;

function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The form's fields of a raw payload (anything else is left out; a non-object → no fields). */
export function leadPayloadOf(raw: unknown, referer: string | null): LeadSubmitPayload {
  const payload: Record<string, unknown> = {};
  if (isRecord(raw)) {
    for (const field of FORM_FIELDS) {
      const value: unknown = Reflect.get(raw, field);
      if (value !== undefined) payload[field] = value;
    }
  }
  if (referer !== null) payload.referer = referer;
  return payload;
}

export async function submitLeadForVisitor(raw: unknown, context: SubmitLeadContext): Promise<SubmitLeadOutcome> {
  const result = await submitLead(leadPayloadOf(raw, context.referer), context.visitor);
  if (result.ok) return { status: 'created', id: result.data.id };
  return outcomeOf(result.failure);
}

function outcomeOf(failure: ApiFailure): SubmitLeadOutcome {
  if (failure.kind === 'validation') {
    const errors = fieldErrorsOf(failure.fields);
    if (Object.keys(errors).length > 0) return { status: 'invalid', errors };
  }
  if (failure.kind === 'domain' && failure.status === 429) {
    return { status: 'rate_limited', retryAfterSeconds: retryAfterOf(failure.details?.retryAfterSeconds) };
  }
  return { status: 'failed', reason: describeFailure(failure) };
}

/** The backend's field errors → the form's error codes (fields / keys the form does not know are left out). */
function fieldErrorsOf(fields: Readonly<Record<string, MessageRef>>): LeadFieldErrors {
  const errors: LeadFieldErrors = {};
  for (const field of LEAD_ERROR_FIELDS) {
    const ref = fields[field];
    const error = ref ? fieldErrorOf(ref) : null;
    if (error) errors[field] = error;
  }
  return errors;
}

function isSimpleCode(code: string): code is LeadSimpleErrorCode {
  return (LEAD_SIMPLE_ERROR_CODES as ReadonlyArray<string>).includes(code);
}

function fieldErrorOf({ key, values }: MessageRef): LeadFieldError | null {
  const code = key.startsWith(FORM_ERROR_PREFIX) ? key.slice(FORM_ERROR_PREFIX.length) : '';
  if (code === 'tooShort') return typeof values?.min === 'number' ? { code, min: values.min } : null;
  if (code === 'tooLong') return typeof values?.max === 'number' ? { code, max: values.max } : null;
  return isSimpleCode(code) ? { code } : null;
}

function retryAfterOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : DEFAULT_RETRY_AFTER_SECONDS;
}
