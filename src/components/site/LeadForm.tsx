"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  type ReactNode,
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import type { LeadType } from "@/generated/prisma/enums";
import type { Locale } from "@/i18n/locales";
import {
  DEFAULT_LEAD_TYPE,
  LEAD_HONEYPOT_FIELD,
  LEAD_INTENT_EVENT,
  LEAD_INTENT_PARAMS,
  LEAD_LIMITS,
  LEAD_RESULT_ANCHORS,
  LEAD_TOPICS,
  type LeadErrorField,
  type LeadFieldError,
  type LeadFormCopy,
  type LeadInputField,
  type LeadIntent,
  type LeadRequestBody,
  isLeadType,
  leadFieldsFor,
  leadIntentFromSearch,
  needsEmailOrPhone,
  parseLeadIntent,
} from "@/lib/lead-form-config";
import type * as Leads from "@/lib/leads";
import { fill, type FormMessages } from "./labels";
import { motionEnabled } from "./motion/env";
import { gsap } from "./motion/gsap";

/**
 * The site's lead form — «Письмо в редакцию» in the contacts section (client component,
 * server-rendered inside the section).
 *
 * - «Тема» selects the lead type (TAILORING / PARTNERSHIP / CONTACT); the visible inputs and
 *   which of them are required follow LEAD_FORM_FIELDS — the same zod rules the API applies.
 *   The zod validator (src/lib/leads.ts) is not part of the page's first JS: it is imported
 *   when the form comes within a viewport of the screen or is touched (focus, pointer, key),
 *   whichever is first, and a submit waits for it. Until then no error can be shown anyway
 *   (errors appear after a field was left or after submit), so nothing renders differently.
 * - CTA buttons elsewhere preselect the topic and show / prefill a subject ("Заказ: …"):
 *   in-page links dispatch a LeadIntent event (SmoothScroll), links from other pages carry
 *   ?topic=…&subject=… (read once after hydration, then removed from the address bar).
 * - Validation on blur and submit (validateLeadInput), server field errors inline, honeypot,
 *   consent checkbox, pending / success / error states and a persistent live region.
 *
 * Focus: state updates that render errors are committed with flushSync BEFORE focus moves,
 * so the focused field already has aria-invalid + aria-describedby → its error. After success
 * (the form is replaced) focus goes to «send another»; after it — back to the first field.
 *
 * Without JS (or before hydration) the form is a plain POST to /api/leads (urlencoded, browser
 * validation of the `required` fields); the route answers 303 → /#lead-sent | #lead-invalid |
 * #lead-failed, and the matching notice below is shown by CSS :target. The visitor's data
 * never travels in a URL.
 */

type Values = {
  name: string;
  email: string;
  phone: string;
  message: string;
  consent: boolean;
  hp: string;
};

const EMPTY_VALUES: Values = { name: "", email: "", phone: "", message: "", consent: false, hp: "" };

const noopSubscribe = (): (() => void) => () => {};

type Status = "idle" | "pending" | "success" | "error";

/** Displayed error per field (already localized). */
type ErrorMessages = Partial<Record<LeadErrorField, string>>;

const INPUT_ATTRS: Readonly<
  Record<LeadInputField, { type: string; autoComplete: string; inputMode?: "email" | "tel" | "text"; maxLength: number }>
> = {
  name: { type: "text", autoComplete: "name", maxLength: LEAD_LIMITS.nameMax },
  email: { type: "email", autoComplete: "email", inputMode: "email", maxLength: LEAD_LIMITS.emailMax },
  phone: { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: LEAD_LIMITS.phoneMax },
  message: { type: "text", autoComplete: "off", maxLength: LEAD_LIMITS.messageMax },
};

/** Which displayed fields an error should mark as invalid. */
function fieldsOf(errorField: LeadErrorField): LeadInputField[] {
  switch (errorField) {
    case "contact":
      return ["email", "phone"];
    case "name":
    case "email":
    case "phone":
    case "message":
      return [errorField];
    default:
      return [];
  }
}

/** Removes ?topic / ?subject from the address bar (keeps other params and the hash). */
function clearIntentFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(LEAD_INTENT_PARAMS.type);
  url.searchParams.delete(LEAD_INTENT_PARAMS.subject);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/** The zod validator (src/lib/leads.ts): loaded when the form is approached or touched. */
type LeadValidator = Pick<typeof Leads, "validateLeadInput" | "leadApiResponseSchema">;

let validatorPromise: Promise<LeadValidator> | null = null;

/** One shared import for every form on the page; a failed load (offline) can be retried. */
function loadValidator(): Promise<LeadValidator> {
  validatorPromise ??= import("@/lib/leads").catch((error: unknown) => {
    validatorPromise = null;
    throw error;
  });
  return validatorPromise;
}

export type LeadFormProps = {
  locale: Locale;
  /** Copy from the CMS; empty strings fall back to messages (forms.*). */
  copy: LeadFormCopy;
  /** messages/*.json `forms` (resolved on the server; templates filled with fill()). */
  labels: FormMessages;
};

export function LeadForm({ locale, copy, labels }: LeadFormProps): ReactElement {
  const baseId = useId();

  const [type, setType] = useState<LeadType>(DEFAULT_LEAD_TYPE);
  const [subject, setSubject] = useState("");
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [touched, setTouched] = useState<Partial<Record<LeadErrorField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<ErrorMessages>({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  /** The no-JS result notices (:target) are dropped once the form was used with JS. */
  const [usedWithJs, setUsedWithJs] = useState(false);
  /** false in the server HTML and during hydration: the browser validates `required` fields then. */
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [validator, setValidator] = useState<LeadValidator | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const awaitingValidatorRef = useRef(false);
  const againRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLParagraphElement>(null);
  /** The text last prefilled into the message (replaced by the next CTA unless edited). */
  const prefillRef = useRef("");

  const fields = leadFieldsFor(type);
  const showContactGroup = needsEmailOrPhone(type);

  const ensureValidator = useCallback(
    (): Promise<LeadValidator> =>
      loadValidator().then((loaded) => {
        setValidator((previous) => previous ?? loaded);
        return loaded;
      }),
    [],
  );
  const preloadValidator = (): void => {
    if (!validator) void ensureValidator().catch(() => undefined);
  };

  // Load the validator once the form is within about a viewport of the screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void ensureValidator().catch(() => undefined);
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [ensureValidator]);

  // CTA → form: preselect the topic, show the subject and prefill it into an untouched message.
  useEffect(() => {
    const apply = (intent: LeadIntent): void => {
      setType(intent.type);
      setSubject(intent.subject);
      setServerErrors({});
      setStatus((previous) => (previous === "success" || previous === "error" ? "idle" : previous));
      // Replace the message only while it is empty or still exactly the previous prefill.
      const previousPrefill = prefillRef.current;
      const prefill = intent.subject ? `${intent.subject}\n` : "";
      setValues((previous) => {
        const untouched = previous.message.trim() === "" || previous.message === previousPrefill;
        return untouched ? { ...previous, message: prefill } : previous;
      });
      prefillRef.current = prefill;
    };
    const onIntent = (event: Event): void => {
      const intent = event instanceof CustomEvent ? parseLeadIntent(event.detail) : null;
      if (intent) apply(intent);
    };
    window.addEventListener(LEAD_INTENT_EVENT, onIntent);

    // Links from other pages (e.g. «Заказать» on a collection page): apply after hydration.
    const fromUrl = leadIntentFromSearch(window.location.search);
    const timer = fromUrl
      ? window.setTimeout(() => {
          apply(fromUrl);
          clearIntentFromUrl();
        }, 0)
      : undefined;

    return () => {
      window.removeEventListener(LEAD_INTENT_EVENT, onIntent);
      window.clearTimeout(timer);
    };
  }, []);

  // Success: the «letter received» bubble pops in.
  useEffect(() => {
    if (status !== "success" || !okRef.current || !motionEnabled()) return;
    const tween = gsap.fromTo(
      okRef.current,
      { scale: 0.4, rotation: -8, opacity: 0 },
      { scale: 1, rotation: -2, opacity: 1, duration: 0.6, ease: "back.out(2.4)" },
    );
    return () => {
      tween.revert();
    };
  }, [status]);

  const translateError = (error: LeadFieldError): string => {
    switch (error.code) {
      case "tooShort":
        return fill(labels.errors.tooShort, { min: error.min });
      case "tooLong":
        return fill(labels.errors.tooLong, { max: error.max });
      default:
        return labels.errors[error.code];
    }
  };

  /** Only the inputs of the selected topic are sent (a hidden phone never leaks into CONTACT). */
  const buildBody = (current: Values, leadType: LeadType): LeadRequestBody => {
    const visible = new Set(leadFieldsFor(leadType).map((field) => field.name));
    return {
      type: leadType,
      locale,
      name: current.name,
      email: visible.has("email") ? current.email : "",
      phone: visible.has("phone") ? current.phone : "",
      message: current.message,
      consent: current.consent,
      [LEAD_HONEYPOT_FIELD]: current.hp,
    };
  };

  // An error is shown after submit, or once its field was left (the "email or phone"
  // group error only after both fields were visited).
  const isShown = (field: LeadErrorField): boolean =>
    submitted || (field === "contact" ? touched.email === true && touched.phone === true : touched[field] === true);

  // Client-side errors are derived from the current values (no extra state). Before the
  // validator has loaded nothing was left or submitted yet, so there is nothing to show.
  const validation = validator ? validator.validateLeadInput({ ...buildBody(values, type), [LEAD_HONEYPOT_FIELD]: "" }) : null;
  const clientErrors: ErrorMessages = {};
  if (validation && !validation.ok && validation.reason === "invalid") {
    for (const [field, error] of Object.entries(validation.errors) as Array<[LeadErrorField, LeadFieldError | undefined]>) {
      if (error && isShown(field)) clientErrors[field] = translateError(error);
    }
  }
  const errors: ErrorMessages = { ...serverErrors, ...clientErrors };

  const labelFor = (field: LeadInputField): string => copy.labels[field].trim() || labels.fields[field];
  const fieldId = (field: string): string => `${baseId}-${field}`;
  const errorId = (field: LeadErrorField): string => `${baseId}-${field}-error`;

  const isFieldInvalid = (field: LeadInputField): boolean =>
    (Object.keys(errors) as LeadErrorField[]).some((key) => errors[key] && fieldsOf(key).includes(field));

  const describedBy = (field: LeadInputField): string | undefined => {
    const ids: string[] = [];
    if (errors[field]) ids.push(errorId(field));
    if ((field === "email" || field === "phone") && showContactGroup) {
      ids.push(errors.contact ? errorId("contact") : `${baseId}-contact-hint`);
    }
    return ids.length > 0 ? ids.join(" ") : undefined;
  };

  const clearServerError = (...keys: LeadErrorField[]): void => {
    if (keys.some((key) => serverErrors[key])) {
      setServerErrors((previous) => {
        const next = { ...previous };
        for (const key of keys) delete next[key];
        return next;
      });
    }
  };

  const onTopicChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = event.target.value;
    if (!isLeadType(next)) return;
    setType(next);
    setServerErrors({});
    if (status === "error") setStatus("idle");
  };

  const onFieldChange = (field: LeadInputField) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setValues((previous) => ({ ...previous, [field]: value }));
    clearServerError(field, ...(field === "email" || field === "phone" ? (["contact"] as const) : []));
    if (status === "error") setStatus("idle");
  };

  const onFieldBlur = (field: LeadInputField) => () => {
    setTouched((previous) => (previous[field] ? previous : { ...previous, [field]: true }));
  };

  const focusFirstInvalid = (messages: ErrorMessages): void => {
    const firstField = fields
      .map((field) => field.name)
      .find((field) => (Object.keys(messages) as LeadErrorField[]).some((key) => messages[key] && fieldsOf(key).includes(field)));
    const target = firstField ? fieldId(firstField) : messages.consent ? fieldId("consent") : messages.type ? fieldId("topic") : null;
    if (target) document.getElementById(target)?.focus();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (status === "pending" || awaitingValidatorRef.current) return;
    setUsedWithJs(true);

    let loaded: LeadValidator;
    try {
      // Normally loaded long before (the form was approached / focused); a second submit
      // while it is still on its way is ignored.
      awaitingValidatorRef.current = true;
      loaded = validator ?? (await ensureValidator());
    } catch {
      setStatus("error");
      setStatusMessage(labels.errors.network);
      return;
    } finally {
      awaitingValidatorRef.current = false;
    }
    const check = loaded.validateLeadInput({ ...buildBody(values, type), [LEAD_HONEYPOT_FIELD]: "" });
    if (!check.ok && check.reason === "invalid") {
      const messages: ErrorMessages = {};
      for (const [field, error] of Object.entries(check.errors) as Array<[LeadErrorField, LeadFieldError | undefined]>) {
        if (error) messages[field] = translateError(error);
      }
      // Commit the error markup (aria-invalid, aria-describedby, error text) first …
      flushSync(() => {
        setSubmitted(true);
        setServerErrors({});
        setStatus("error");
        setStatusMessage(labels.errors.invalidForm);
      });
      // … then move focus, so the field is announced together with its error.
      focusFirstInvalid(messages);
      return;
    }

    setSubmitted(true);
    setServerErrors({});
    setStatus("pending");
    setStatusMessage(labels.sending);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(buildBody(values, type)),
      });
      const parsed = loaded.leadApiResponseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) {
        setStatus("error");
        setStatusMessage(labels.errors.server);
        return;
      }
      const result = parsed.data;
      if (result.ok) {
        // The form (and the focused submit button) is replaced by the success message:
        // render it, then put focus on «send another» so keyboard users keep their place.
        flushSync(() => {
          setStatus("success");
          setStatusMessage(copy.success.trim() || labels.successDefault);
          setValues(EMPTY_VALUES);
          setTouched({});
          setSubmitted(false);
          setSubject("");
        });
        prefillRef.current = "";
        againRef.current?.focus();
        return;
      }
      const fieldErrors = result.fieldErrors;
      flushSync(() => {
        setStatus("error");
        setStatusMessage(result.message);
        if (fieldErrors) setServerErrors(fieldErrors);
      });
      if (fieldErrors) focusFirstInvalid(fieldErrors);
    } catch {
      setStatus("error");
      setStatusMessage(labels.errors.network);
    }
  };

  const resetAfterSuccess = (): void => {
    // The «send another» button disappears; continue in the first field of the new form.
    flushSync(() => {
      setStatus("idle");
      setStatusMessage("");
    });
    const first = fields[0];
    if (first) document.getElementById(fieldId(first.name))?.focus();
  };

  const pending = status === "pending";

  /** "E-mail or phone" hint / group error — right after the phone field (tailoring, partnership). */
  const contactGroup: ReactNode = showContactGroup ? (
    errors.contact ? (
      <p id={errorId("contact")} className="field__err">
        {errors.contact}
      </p>
    ) : (
      <p id={`${baseId}-contact-hint`} className="form__hint">
        {labels.contactHint}
      </p>
    )
  ) : null;

  const renderError = (field: LeadErrorField): ReactNode =>
    errors[field] ? (
      <p id={errorId(field)} className="field__err">
        {errors[field]}
      </p>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={`lead-form${status !== "idle" ? ` is-${status}` : ""}`}
      data-lead-type={type}
      onFocusCapture={preloadValidator}
      onPointerDownCapture={preloadValidator}
      onKeyDownCapture={preloadValidator}
    >
      {subject && status !== "success" ? (
        <p className="letter__re">
          <span data-edit="contacts.form.subjectLabel">{copy.subjectLabel}</span> <b>{subject}</b>
        </p>
      ) : null}

      {usedWithJs ? null : (
        <>
          <p id={LEAD_RESULT_ANCHORS.sent} className="form__notice">
            {copy.success.trim() || labels.successDefault}
          </p>
          <p id={LEAD_RESULT_ANCHORS.invalid} className="form__notice form__notice--error">
            {labels.noscriptInvalid}
          </p>
          <p id={LEAD_RESULT_ANCHORS.failed} className="form__notice form__notice--error">
            {labels.errors.server}
          </p>
        </>
      )}

      {status !== "success" ? (
        <form
          className="form"
          method="post"
          action="/api/leads"
          noValidate={hydrated}
          aria-busy={pending}
          onSubmit={(event) => void onSubmit(event)}
        >
          <input type="hidden" name="locale" value={locale} />
          <div className={`field${errors.type ? " is-bad" : ""}`}>
            <label htmlFor={fieldId("topic")} data-edit="contacts.form.topicLabel">
              {copy.topicLabel.trim() || labels.topicDefault}
            </label>
            <select
              id={fieldId("topic")}
              name="type"
              value={type}
              onChange={onTopicChange}
              disabled={pending}
              aria-invalid={errors.type ? true : undefined}
              aria-describedby={errors.type ? errorId("type") : undefined}
            >
              {LEAD_TOPICS.map((topic) => (
                <option key={topic.type} value={topic.type}>
                  {copy.topics[topic.type].trim() || labels.topics[topic.type]}
                </option>
              ))}
            </select>
            {renderError("type")}
          </div>

          {fields.map(({ name: field, required }) => {
            const attrs = INPUT_ATTRS[field];
            const invalid = isFieldInvalid(field);
            const common = {
              id: fieldId(field),
              name: field,
              value: values[field],
              maxLength: attrs.maxLength,
              placeholder: copy.placeholders[field] || undefined,
              required,
              "aria-required": required || undefined,
              "aria-invalid": invalid || undefined,
              "aria-describedby": describedBy(field),
              onChange: onFieldChange(field),
              onBlur: onFieldBlur(field),
              readOnly: pending,
            };
            const input = (
              <div key={field} className={`field field--${field}${invalid ? " is-bad" : ""}`}>
                <label htmlFor={fieldId(field)}>
                  {labelFor(field)}
                  {required ? (
                    <span className="field__req" title={labels.requiredMark} aria-hidden="true">
                      {" *"}
                    </span>
                  ) : null}
                </label>
                {field === "message" ? (
                  <textarea {...common} rows={4} />
                ) : (
                  <input {...common} type={attrs.type} autoComplete={attrs.autoComplete} inputMode={attrs.inputMode} />
                )}
                {renderError(field)}
              </div>
            );
            return field === "phone" ? (
              <Fragment key={field}>
                {input}
                {contactGroup}
              </Fragment>
            ) : (
              input
            );
          })}

          {/* Honeypot: invisible for people and assistive tech; bots fill it in. */}
          <div className="form__hp" aria-hidden="true">
            <label htmlFor={fieldId(LEAD_HONEYPOT_FIELD)}>{labels.honeypotLabel}</label>
            <input
              id={fieldId(LEAD_HONEYPOT_FIELD)}
              name={LEAD_HONEYPOT_FIELD}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.hp}
              onChange={(event) => setValues((previous) => ({ ...previous, hp: event.target.value }))}
            />
          </div>

          <div className={`form__consent${errors.consent ? " is-bad" : ""}`}>
            <input
              id={fieldId("consent")}
              name="consent"
              type="checkbox"
              className="form__check"
              checked={values.consent}
              required
              aria-required="true"
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? errorId("consent") : undefined}
              onChange={(event) => {
                if (pending) return;
                const checked = event.target.checked;
                setValues((previous) => ({ ...previous, consent: checked }));
                setTouched((previous) => ({ ...previous, consent: true }));
                clearServerError("consent");
              }}
            />
            <label htmlFor={fieldId("consent")} data-edit="contacts.form.consent">
              {copy.consent.trim() || labels.consent}
            </label>
            {renderError("consent")}
          </div>

          {/* aria-disabled instead of disabled: the button keeps focus while sending. */}
          <button type="submit" className="btn btn--red form__submit" aria-disabled={pending || undefined}>
            <span className="btn__face" data-edit="contacts.form.submit">
              {pending ? labels.sending : copy.submit.trim() || labels.submitDefault}
            </span>
          </button>
        </form>
      ) : null}

      {/* Persistent live region: announces sending / errors / success (also after the form is replaced). */}
      <p
        ref={okRef}
        className={status === "success" ? "form__ok" : `form__status${status === "error" ? " is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {status === "idle" ? "" : statusMessage}
      </p>

      {status === "success" ? (
        <button ref={againRef} type="button" className="link-btn link-btn--paper form__again" onClick={resetAfterSuccess}>
          {labels.sendAnother} <span className="glyph" aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}
