import { z } from "zod";
import type { LeadType } from "@/generated/prisma/enums";
import { defaultLocale, locales, type Locale } from "@/i18n/locales";
import type { TextKey } from "@/lib/content/registry";
import {
  LEAD_ERROR_FIELDS,
  LEAD_HONEYPOT_FIELD,
  LEAD_LIMITS,
  LEAD_SIMPLE_ERROR_CODES,
  type LeadErrorField,
  type LeadFieldError,
  type LeadFieldErrors,
  type LeadFormCopy,
  type LeadSimpleErrorCode,
  type LeadApiErrorCode,
} from "./lead-form-config";

export * from "./lead-form-config";

/**
 * Lead (заявка) validation and API contract — ISOMORPHIC.
 *
 * Used by:
 *  - POST /api/leads (src/app/api/leads/route.ts) — server-side validation;
 *  - <LeadForm/> (src/components/site/LeadForm.tsx) — the same rules for inline validation;
 *  - CTA links that open the form with a preselected topic (LeadIntent — ./lead-intent.ts,
 *    zod-free for the layout-level client code; re-exported here).
 *
 * The zod-free part (limits, field configuration, error codes, API types) lives in
 * ./lead-form-config.ts and is re-exported here; the form ships only that until it is used.
 *
 * No server-only imports here (DB / Telegram code lives in src/app/api/leads/* and
 * src/lib/telegram.ts).
 */

/** Max size of the JSON body accepted by POST /api/leads. */
export const LEAD_MAX_BODY_BYTES = 16 * 1024;

function isSimpleErrorCode(value: string): value is LeadSimpleErrorCode {
  return (LEAD_SIMPLE_ERROR_CODES as ReadonlyArray<string>).includes(value);
}

function isLeadErrorField(value: unknown): value is LeadErrorField {
  return typeof value === "string" && (LEAD_ERROR_FIELDS as ReadonlyArray<string>).includes(value);
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
  const hasPlus = value.startsWith("+");
  let digits = value.replace(/\D/g, "");
  if (!hasPlus) {
    if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
    else if (digits.length === 10 && digits.startsWith("9")) digits = `7${digits}`;
  }
  if (digits.length < 10 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

/** Treat "", "   ", null and undefined as "not provided". */
function emptyToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  return value;
}

// ─── Schema ─────────────────────────────────────────────────────────────────
// Error messages are LeadErrorCode strings; mapLeadIssues() turns them into LeadFieldError.

const nameSchema = z
  .string({ error: "required" })
  .trim()
  .min(1, { error: "required" })
  .min(LEAD_LIMITS.nameMin, { error: "tooShort" })
  .max(LEAD_LIMITS.nameMax, { error: "tooLong" });

const emailValueSchema = z
  .string({ error: "invalidEmail" })
  .trim()
  .max(LEAD_LIMITS.emailMax, { error: "tooLong" })
  .pipe(z.email({ error: "invalidEmail" }));

const phoneValueSchema = z
  .string({ error: "invalidPhone" })
  .trim()
  .max(LEAD_LIMITS.phoneMax, { error: "tooLong" })
  .transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (phone === null) {
      ctx.addIssue({ code: "custom", message: "invalidPhone" });
      return z.NEVER;
    }
    return phone;
  });

const optionalEmail = z.preprocess(emptyToUndefined, emailValueSchema.optional());
const requiredEmail = z.preprocess(emptyToUndefined, z.string({ error: "required" }).pipe(emailValueSchema));
const optionalPhone = z.preprocess(emptyToUndefined, phoneValueSchema.optional());

const messageSchema = z.preprocess(
  (value) => (value === null || value === undefined ? "" : value),
  z.string({ error: "invalid" }).trim().max(LEAD_LIMITS.messageMax, { error: "tooLong" }),
);

const leadLocaleSchema = z.enum(locales).catch(defaultLocale);

const baseShape = {
  name: nameSchema,
  email: optionalEmail,
  phone: optionalPhone,
  message: messageSchema,
  locale: leadLocaleSchema,
  /** Personal data processing consent (152-ФЗ) — the checkbox must be ticked. */
  consent: z.literal(true, { error: "consentRequired" }),
  /** Honeypot — must be empty. */
  [LEAD_HONEYPOT_FIELD]: z.string().max(0, { error: "honeypot" }).optional(),
};

type ContactFields = { email?: unknown; phone?: unknown };

const isFilled = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

function requireEmailOrPhone(value: ContactFields, ctx: z.RefinementCtx): void {
  if (!isFilled(value.email) && !isFilled(value.phone)) {
    ctx.addIssue({ code: "custom", path: ["contact"], message: "contactRequired" });
  }
}

/** Run the "email or phone" check even when other fields failed, so all errors show at once. */
const contactCheckParams = {
  when: (payload: { value: unknown }) => typeof payload.value === "object" && payload.value !== null,
};

/**
 * Lead submission schema (discriminated by `type`):
 *  - TAILORING / PARTNERSHIP: name + (email or phone) + optional message;
 *  - CONTACT: name + email (required) + optional phone/message.
 * All types: consent must be `true`, honeypot must be empty, locale falls back to ru.
 */
export const leadSubmissionSchema = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("TAILORING"), ...baseShape }).superRefine(requireEmailOrPhone, contactCheckParams),
    z.object({ type: z.literal("PARTNERSHIP"), ...baseShape }).superRefine(requireEmailOrPhone, contactCheckParams),
    z.object({ type: z.literal("CONTACT"), ...baseShape, email: requiredEmail }),
  ],
  { error: "invalidType" },
);

type ParsedLead = z.output<typeof leadSubmissionSchema>;

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

function toSubmission(parsed: ParsedLead): LeadSubmission {
  return {
    type: parsed.type,
    name: parsed.name,
    email: parsed.email ?? null,
    phone: parsed.phone ?? null,
    message: parsed.message,
    locale: parsed.locale,
  };
}

function toFieldError(code: string): LeadFieldError | null {
  if (code === "tooShort") return { code, min: LEAD_LIMITS.nameMin };
  if (isSimpleErrorCode(code)) return { code };
  return null;
}

function tooLongFor(field: LeadErrorField): LeadFieldError {
  switch (field) {
    case "name":
      return { code: "tooLong", max: LEAD_LIMITS.nameMax };
    case "email":
      return { code: "tooLong", max: LEAD_LIMITS.emailMax };
    case "phone":
      return { code: "tooLong", max: LEAD_LIMITS.phoneMax };
    case "message":
      return { code: "tooLong", max: LEAD_LIMITS.messageMax };
    default:
      return { code: "invalid" };
  }
}

/** zod issues → the first error per field (issues come in check order). */
function mapLeadIssues(issues: ReadonlyArray<z.core.$ZodIssue>): LeadFieldErrors {
  const errors: LeadFieldErrors = {};
  for (const issue of issues) {
    const head = issue.path[0];
    // Root-level issues (not an object, unknown discriminator) are reported on `type`.
    const field: LeadErrorField = isLeadErrorField(head) ? head : "type";
    if (errors[field]) continue;
    const mapped = issue.message === "tooLong" ? tooLongFor(field) : toFieldError(issue.message);
    errors[field] = mapped ?? { code: "invalid" };
  }
  // A typed but invalid phone / e-mail already has its own error («Укажите корректный номер»);
  // «Укажите e-mail или телефон» on top of it would claim that nothing was entered.
  if (errors.contact?.code === "contactRequired" && (errors.email || errors.phone)) delete errors.contact;
  return errors;
}

export type LeadValidationResult =
  | { ok: true; data: LeadSubmission }
  | { ok: false; reason: "honeypot" }
  | { ok: false; reason: "invalid"; errors: LeadFieldErrors };

/** True when the raw payload has a non-empty honeypot value (any type). */
function honeypotFilled(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  const value: unknown = Reflect.get(input, LEAD_HONEYPOT_FIELD);
  if (value === undefined || value === null) return false;
  return typeof value !== "string" || value.length > 0;
}

/**
 * Validate a raw lead payload (parsed JSON or form state).
 * - honeypot filled → `{ ok: false, reason: "honeypot" }` (the API pretends success);
 * - otherwise zod errors → per-field error codes.
 */
export function validateLeadInput(input: unknown): LeadValidationResult {
  if (honeypotFilled(input)) return { ok: false, reason: "honeypot" };
  const parsed = leadSubmissionSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: toSubmission(parsed.data) };
  return { ok: false, reason: "invalid", errors: mapLeadIssues(parsed.error.issues) };
}

/** Locale of a raw payload (for localized API errors), falling back to ru. */
export function leadLocaleOf(input: unknown): Locale {
  if (typeof input !== "object" || input === null) return defaultLocale;
  return leadLocaleSchema.parse(Reflect.get(input, "locale"));
}

/** Build the contact form copy from the landing texts (LandingContent.texts). */
export function leadFormCopyFromTexts(texts: Readonly<Record<TextKey, string>>): LeadFormCopy {
  return {
    topicLabel: texts["contacts.form.topicLabel"],
    topics: {
      TAILORING: texts["contacts.form.topics.tailoring"],
      PARTNERSHIP: texts["contacts.form.topics.partnership"],
      CONTACT: texts["contacts.form.topics.contact"],
    },
    subjectLabel: texts["contacts.form.subjectLabel"],
    labels: {
      email: texts["contacts.form.emailLabel"],
      name: texts["contacts.form.nameLabel"],
      phone: texts["contacts.form.phoneLabel"],
      message: texts["contacts.form.commentLabel"],
    },
    placeholders: {
      email: texts["contacts.form.emailPlaceholder"],
      name: texts["contacts.form.namePlaceholder"],
      phone: texts["contacts.form.phonePlaceholder"],
      message: texts["contacts.form.commentPlaceholder"],
    },
    consent: texts["contacts.form.consent"],
    submit: texts["contacts.form.submit"],
    success: texts["contacts.form.success"],
  };
}

// ─── Plain HTML form posts (no JS yet / no JS at all) ───────────────────────

/** A urlencoded form body → the raw payload validateLeadInput() expects (checkbox "on" → true). */
export function leadInputFromForm(params: URLSearchParams): Record<string, unknown> {
  const text = (name: string): string | undefined => params.get(name) ?? undefined;
  const consent = params.get("consent");
  return {
    type: text("type"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    message: text("message"),
    locale: text("locale"),
    consent: consent === "on" || consent === "true",
    [LEAD_HONEYPOT_FIELD]: text(LEAD_HONEYPOT_FIELD),
  };
}

// ─── API contract (POST /api/leads) ─────────────────────────────────────────

const apiErrorCodes = [
  "invalid_form",
  "bad_request",
  "unsupported_media_type",
  "payload_too_large",
  "rate_limited",
  "server_error",
] as const satisfies ReadonlyArray<LeadApiErrorCode>;

/** zod schema of the API response (the form validates what it receives). */
export const leadApiResponseSchema = z.union([
  z.object({ ok: z.literal(true), id: z.string() }),
  z.object({
    ok: z.literal(false),
    error: z.enum(apiErrorCodes),
    message: z.string(),
    fieldErrors: z.partialRecord(z.enum(LEAD_ERROR_FIELDS), z.string()).optional(),
    retryAfter: z.number().optional(),
  }),
]);
