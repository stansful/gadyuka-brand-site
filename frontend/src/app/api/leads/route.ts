import { getTranslations } from 'next-intl/server';
import { after, type NextRequest, NextResponse } from 'next/server';

import type { Locale } from '@/i18n/locales';
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
import { rateLimitKey } from '@/lib/rate-limit';
import { localizedPath } from '@/lib/seo/site-url';
import { notifyCeilingError, sendLeadToTelegram } from '@/lib/telegram';

import { withLeadLock } from './store';
import { submitLead, type SubmitLeadOutcome } from './submit';

/**
 * POST /api/leads — lead forms (TAILORING | PARTNERSHIP | CONTACT).
 *
 * Request:  Content-Type: application/json, body = LeadRequestBody (src/lib/leads.ts), ≤ 16 KB.
 * Response: LeadApiResponse —
 *   201 { ok: true, id }                         saved (Telegram is sent after the response)
 *   400 { ok: false, error: "bad_request" }      body is not valid JSON
 *   413 { ok: false, error: "payload_too_large" }
 *   415 { ok: false, error: "unsupported_media_type" }
 *   422 { ok: false, error: "invalid_form", fieldErrors }
 *   429 { ok: false, error: "rate_limited", retryAfter } + Retry-After header
 *   500 { ok: false, error: "server_error" }  (DB down, or IP_HASH_SALT missing in production)
 * Honeypot hits get a 201 without being stored.
 *
 * Plain HTML form posts (no JS, or submitted before hydration): Content-Type
 * application/x-www-form-urlencoded, same fields (+ consent=on) → always 303 See Other back to
 * the landing of the form's locale at #lead-sent / #lead-invalid / #lead-failed (the form shows
 * the matching notice via :target). The personal data never ends up in a URL. Cross-site form
 * posts (Sec-Fetch-Site: cross-site) are refused.
 */

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

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

function localizeFieldErrors(t: ErrorsTranslator, errors: LeadFieldErrors): Partial<Record<LeadErrorField, string>> {
  const out: Partial<Record<LeadErrorField, string>> = {};
  for (const [field, error] of Object.entries(errors) as Array<[LeadErrorField, LeadFieldError | undefined]>) {
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

/** Validate → rate limit → store → Telegram after the response (shared by JSON and form posts). */
function submit(request: NextRequest, raw: unknown, ipHash: string): Promise<SubmitLeadOutcome> {
  return submitLead(
    raw,
    {
      ipHash,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
    },
    {
      withLock: withLeadLock,
      notify: lead => sendLeadToTelegram(lead),
      ceilingError: notifyCeilingError,
      schedule: task => after(task),
    },
  );
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
    case 'ignored':
      return 'sent';
    case 'invalid':
      return 'invalid';
    case 'rate_limited':
    case 'failed':
      return 'failed';
  }
}

/** POST from the plain HTML form (no JS): validated and stored like JSON, answered with a 303. */
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
  const locale = leadLocaleOf(raw);

  let ipHash: string;
  try {
    ipHash = rateLimitKey(request.headers);
  } catch (error: unknown) {
    console.error('[leads] cannot hash the client IP:', error);
    return backToForm(locale, 'failed');
  }

  const outcome = await submit(request, raw, ipHash);
  if (outcome.status === 'ignored') console.warn('[leads] honeypot triggered — submission ignored');
  if (outcome.status === 'failed') console.error('[leads] could not save a lead:', outcome.error);
  return backToForm(locale, resultOf(outcome));
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

  const locale = leadLocaleOf(raw);
  const t = await errorsTranslator(locale);

  let ipHash: string;
  try {
    ipHash = rateLimitKey(request.headers);
  } catch (error: unknown) {
    // IP_HASH_SALT missing/short in production: refuse rather than store reversible IP hashes.
    console.error('[leads] cannot hash the client IP:', error);
    return failure('server_error', t('server'), 500);
  }

  const outcome = await submit(request, raw, ipHash);

  switch (outcome.status) {
    case 'created':
      return json({ ok: true, id: outcome.id }, 201);
    case 'ignored':
      // Honeypot: look like a success so bots learn nothing; nothing is stored or sent.
      console.warn('[leads] honeypot triggered — submission ignored');
      return json({ ok: true, id: crypto.randomUUID() }, 201);
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
      console.error('[leads] could not save a lead:', outcome.error);
      return failure('server_error', t('server'), 500);
  }
}
