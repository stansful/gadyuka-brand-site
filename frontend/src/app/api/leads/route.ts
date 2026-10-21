import { getTranslations } from 'next-intl/server';
import { type NextRequest, NextResponse } from 'next/server';

import type { Locale } from '@/i18n/locales';
import { getVisitor } from '@/lib/api/visitor';
import { BodyTooLargeError, readBodyText } from '@/lib/http/read-body';
import {
  LEAD_MAX_BODY_BYTES,
  LEAD_RESULT_ANCHORS,
  type LeadApiErrorCode,
  type LeadApiFailure,
  type LeadApiResponse,
  type LeadErrorField,
  type LeadFieldError,
  type LeadFieldErrors,
  type LeadResult,
  leadInputFromForm,
  leadLocaleOf,
} from '@/lib/leads';
import { localizedPath } from '@/lib/seo/site-url';

import { submitLeadForVisitor, type SubmitLeadOutcome } from './submit';

/**
 * POST /api/leads — lead forms (TAILORING | PARTNERSHIP | CONTACT). The checks, the rate limits, the
 * storage and the Telegram notification are the backend's (POST /api/v1/public/leads, ./submit.ts);
 * this route keeps the site's public contract and answers in the visitor's language.
 *
 * Request:  Content-Type: application/json, body = LeadRequestBody (src/lib/leads.ts), ≤ 16 KB.
 * Response: LeadApiResponse —
 *   201 { ok: true, id }                         saved (Telegram is notified after the answer)
 *   400 { ok: false, error: "bad_request" }      body is not valid JSON
 *   413 { ok: false, error: "payload_too_large" }
 *   415 { ok: false, error: "unsupported_media_type" }
 *   422 { ok: false, error: "invalid_form", fieldErrors }
 *   429 { ok: false, error: "rate_limited", retryAfter } + Retry-After header
 *   500 { ok: false, error: "server_error" }     the lead could not be saved (backend / database down)
 * Honeypot hits get a 201 without being stored.
 *
 * Plain HTML form posts (no JS, or submitted before hydration): Content-Type
 * application/x-www-form-urlencoded, same fields (+ consent=on) → always 303 See Other back to
 * the landing of the form's locale at #lead-sent / #lead-invalid / #lead-failed (the form shows
 * the matching notice via :target). The personal data never ends up in a URL. Cross-site form
 * posts (Sec-Fetch-Site: cross-site) are refused.
 */

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/** Order of `fieldErrors` in the answer: the form's fields, then the topic (type) and the group error. */
const FIELD_ERROR_ORDER = [
  'name',
  'email',
  'phone',
  'message',
  'consent',
  'type',
  'contact',
] as const satisfies ReadonlyArray<LeadErrorField>;

type ErrorsTranslator = Awaited<ReturnType<typeof getTranslations<'forms.errors'>>>;

function mediaTypeOf(value: string | null): string {
  return value?.split(';')[0]?.trim().toLowerCase() ?? '';
}

function isJsonContentType(value: string | null): boolean {
  const mediaType = mediaTypeOf(value);
  return mediaType === 'application/json' || mediaType.endsWith('+json');
}

function isFormContentType(value: string | null): boolean {
  return mediaTypeOf(value) === 'application/x-www-form-urlencoded';
}

function translateFieldError(t: ErrorsTranslator, error: LeadFieldError): string {
  switch (error.code) {
    case 'tooShort':
      return t('tooShort', { min: error.min });
    case 'tooLong':
      return t('tooLong', { max: error.max });
    default:
      return t(error.code);
  }
}

/** Field errors in the visitor's language. */
function localizeFieldErrors(t: ErrorsTranslator, errors: LeadFieldErrors): Partial<Record<LeadErrorField, string>> {
  const out: Partial<Record<LeadErrorField, string>> = {};
  for (const field of FIELD_ERROR_ORDER) {
    const error = errors[field];
    if (error) out[field] = translateFieldError(t, error);
  }
  return out;
}

function json(
  body: LeadApiResponse,
  status: number,
  headers: Record<string, string> = {},
): NextResponse<LeadApiResponse> {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

function failure(
  error: LeadApiErrorCode,
  message: string,
  status: number,
  extra: Partial<Pick<LeadApiFailure, 'fieldErrors' | 'retryAfter'>> = {},
  headers: Record<string, string> = {},
): NextResponse<LeadApiResponse> {
  return json({ ok: false, error, message, ...extra }, status, headers);
}

async function errorsTranslator(locale: Locale): Promise<ErrorsTranslator> {
  return getTranslations({ locale, namespace: 'forms.errors' });
}

/** The form to the backend, for this visitor (shared by JSON and form posts). */
async function submit(request: NextRequest, raw: unknown): Promise<SubmitLeadOutcome> {
  return submitLeadForVisitor(raw, { visitor: await getVisitor(), referer: request.headers.get('referer') });
}

/** 303 to the landing of `locale` at the result anchor (relative Location: right host behind the proxy). */
function backToForm(locale: Locale, result: LeadResult): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { ...NO_STORE, Location: `${localizedPath(locale, '/')}#${LEAD_RESULT_ANCHORS[result]}` },
  });
}

function resultOf(outcome: SubmitLeadOutcome): LeadResult {
  switch (outcome.status) {
    case 'created':
      return 'sent';
    case 'invalid':
      return 'invalid';
    case 'rate_limited':
    case 'failed':
      return 'failed';
  }
}

/** POST from the plain HTML form (no JS): submitted like JSON, answered with a 303. */
async function handleFormPost(request: NextRequest): Promise<NextResponse> {
  // A browser form on another site must not be able to file leads in a visitor's name.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return new NextResponse(null, { status: 403, headers: NO_STORE });
  }
  let raw: Record<string, unknown>;
  try {
    raw = leadInputFromForm(new URLSearchParams(await readBodyText(request, LEAD_MAX_BODY_BYTES)));
  } catch (error: unknown) {
    if (!(error instanceof BodyTooLargeError)) console.error('[leads] unreadable form body:', error);
    return backToForm('ru', 'failed');
  }
  const outcome = await submit(request, raw);
  if (outcome.status === 'failed') console.error('[leads] could not save a lead:', outcome.reason);
  return backToForm(leadLocaleOf(raw), resultOf(outcome));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (isFormContentType(request.headers.get('content-type'))) return handleFormPost(request);

  // The locale for error messages comes from the body; before it is parsed, use ru.
  if (!isJsonContentType(request.headers.get('content-type'))) {
    const t = await errorsTranslator('ru');
    return failure('unsupported_media_type', t('unsupportedMediaType'), 415);
  }

  let raw: unknown;
  try {
    const text = await readBodyText(request, LEAD_MAX_BODY_BYTES);
    raw = JSON.parse(text);
  } catch (error: unknown) {
    const t = await errorsTranslator('ru');
    if (error instanceof BodyTooLargeError) return failure('payload_too_large', t('payloadTooLarge'), 413);
    return failure('bad_request', t('badRequest'), 400);
  }

  const [outcome, t] = await Promise.all([submit(request, raw), errorsTranslator(leadLocaleOf(raw))]);

  switch (outcome.status) {
    case 'created':
      return json({ ok: true, id: outcome.id }, 201);
    case 'invalid':
      return failure('invalid_form', t('invalidForm'), 422, { fieldErrors: localizeFieldErrors(t, outcome.errors) });
    case 'rate_limited':
      return failure(
        'rate_limited',
        t('rateLimited'),
        429,
        { retryAfter: outcome.retryAfterSeconds },
        { 'Retry-After': String(outcome.retryAfterSeconds) },
      );
    case 'failed':
      console.error('[leads] could not save a lead:', outcome.reason);
      return failure('server_error', t('server'), 500);
  }
}
