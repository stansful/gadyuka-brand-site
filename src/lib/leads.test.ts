import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import type { TextKey } from "@/lib/content/registry";
import { TEXT_KEYS } from "@/lib/content/registry";
import {
  LEAD_FORM_FIELDS,
  LEAD_LIMITS,
  LEAD_SUBJECT_MAX,
  LEAD_TOPICS,
  LEAD_TYPES,
  leadApiResponseSchema,
  leadFieldsFor,
  leadFormCopyFromTexts,
  leadIntentFromSearch,
  leadIntentHref,
  leadLocaleOf,
  leadSubject,
  normalizePhone,
  parseLeadIntent,
  validateLeadInput,
} from "./leads";

const base = { name: "Иван Петров", consent: true, locale: "ru", hp: "" } as const;

function errorsOf(input: unknown) {
  const result = validateLeadInput(input);
  if (result.ok || result.reason !== "invalid") throw new Error(`expected invalid, got ${JSON.stringify(result)}`);
  return result.errors;
}

describe("normalizePhone", () => {
  it.each([
    ["+7 (900) 123-45-67", "+79001234567"],
    ["8 900 123 45 67", "+79001234567"],
    ["89001234567", "+79001234567"],
    ["9001234567", "+79001234567"],
    ["+44 20 7946 0958", "+442079460958"],
    ["+375 (29) 123-45-67", "+375291234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "+7 900 abc 45 67", "phone", "+1234567890123456", "0000000000"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("validateLeadInput — TAILORING", () => {
  it("accepts name + phone and normalizes the payload", () => {
    const result = validateLeadInput({
      ...base,
      type: "TAILORING",
      phone: "8 (900) 123-45-67",
      message: "  Хочу худи  ",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        type: "TAILORING",
        name: "Иван Петров",
        email: null,
        phone: "+79001234567",
        message: "Хочу худи",
        locale: "ru",
      },
    });
  });

  it("accepts name + email without a message", () => {
    const result = validateLeadInput({ ...base, type: "TAILORING", email: " ivan@example.org " });
    expect(result.ok && result.data.email).toBe("ivan@example.org");
    expect(result.ok && result.data.message).toBe("");
  });

  it("requires email or phone", () => {
    expect(errorsOf({ ...base, type: "TAILORING", email: "", phone: "  " })).toEqual({
      contact: { code: "contactRequired" },
    });
  });

  it("reports name length limits", () => {
    expect(errorsOf({ ...base, type: "TAILORING", name: " И ", phone: "+79001234567" }).name).toEqual({
      code: "tooShort",
      min: LEAD_LIMITS.nameMin,
    });
    expect(errorsOf({ ...base, type: "TAILORING", name: "x".repeat(81), phone: "+79001234567" }).name).toEqual({
      code: "tooLong",
      max: LEAD_LIMITS.nameMax,
    });
    expect(errorsOf({ ...base, type: "TAILORING", name: "", phone: "+79001234567" }).name).toEqual({
      code: "required",
    });
  });

  it("rejects an invalid phone and a too long message", () => {
    const errors = errorsOf({ ...base, type: "TAILORING", phone: "123", message: "я".repeat(2001) });
    expect(errors.phone).toEqual({ code: "invalidPhone" });
    expect(errors.message).toEqual({ code: "tooLong", max: 2000 });
  });

  it("does not ask for «e-mail or phone» when the typed one is just invalid", () => {
    expect(errorsOf({ ...base, type: "TAILORING", phone: "12" })).toEqual({ phone: { code: "invalidPhone" } });
    expect(errorsOf({ ...base, type: "PARTNERSHIP", email: "not-an-email" })).toEqual({ email: { code: "invalidEmail" } });
  });

  it("requires the personal data consent", () => {
    expect(errorsOf({ ...base, type: "TAILORING", phone: "+79001234567", consent: false }).consent).toEqual({
      code: "consentRequired",
    });
    expect(errorsOf({ type: "TAILORING", name: "Иван", phone: "+79001234567" }).consent).toEqual({
      code: "consentRequired",
    });
  });
});

describe("validateLeadInput — PARTNERSHIP", () => {
  it("accepts name + email + phone", () => {
    const result = validateLeadInput({
      ...base,
      type: "PARTNERSHIP",
      email: "shop@partner.ru",
      phone: "+7 861 200-00-01",
      message: "Предлагаем коллаборацию",
      locale: "en",
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toMatchObject({ type: "PARTNERSHIP", phone: "+78612000001", locale: "en" });
  });

  it("rejects an invalid email", () => {
    expect(errorsOf({ ...base, type: "PARTNERSHIP", email: "not-an-email" }).email).toEqual({ code: "invalidEmail" });
  });
});

describe("validateLeadInput — CONTACT", () => {
  it("accepts name + email", () => {
    const result = validateLeadInput({ ...base, type: "CONTACT", email: "ivan@mail.ru", message: "Вопрос" });
    expect(result.ok).toBe(true);
  });

  it("requires the email even when a phone is given", () => {
    expect(errorsOf({ ...base, type: "CONTACT", phone: "+79001234567" }).email).toEqual({ code: "required" });
    expect(errorsOf({ ...base, type: "CONTACT", email: "  " }).email).toEqual({ code: "required" });
  });
});

describe("validateLeadInput — envelope", () => {
  it("rejects unknown or missing types", () => {
    expect(errorsOf({ ...base, type: "SPAM", email: "a@b.co" })).toEqual({ type: { code: "invalidType" } });
    expect(errorsOf({ ...base, email: "a@b.co" })).toEqual({ type: { code: "invalidType" } });
    expect(errorsOf("not an object")).toEqual({ type: { code: "invalidType" } });
    expect(errorsOf(null)).toEqual({ type: { code: "invalidType" } });
  });

  it("falls back to ru for unknown locales", () => {
    const result = validateLeadInput({ ...base, type: "CONTACT", email: "a@b.co", locale: "de" });
    expect(result.ok && result.data.locale).toBe("ru");
    expect(leadLocaleOf({ locale: "en" })).toBe("en");
    expect(leadLocaleOf({ locale: 42 })).toBe("ru");
    expect(leadLocaleOf(undefined)).toBe("ru");
  });

  it("flags a filled honeypot before any other validation", () => {
    expect(validateLeadInput({ ...base, type: "CONTACT", email: "a@b.co", hp: "http://spam.example" })).toEqual({
      ok: false,
      reason: "honeypot",
    });
    expect(validateLeadInput({ type: "NOPE", hp: "x" })).toEqual({ ok: false, reason: "honeypot" });
    expect(validateLeadInput({ ...base, type: "CONTACT", email: "a@b.co", hp: 1 })).toEqual({
      ok: false,
      reason: "honeypot",
    });
  });

  it("accepts an empty or missing honeypot", () => {
    expect(validateLeadInput({ ...base, type: "CONTACT", email: "a@b.co", hp: "" }).ok).toBe(true);
    const { hp: _hp, ...withoutHoneypot } = base;
    expect(validateLeadInput({ ...withoutHoneypot, type: "CONTACT", email: "a@b.co" }).ok).toBe(true);
  });
});

describe("form configuration", () => {
  it("shows the email first and requires it in the contact form", () => {
    expect(LEAD_FORM_FIELDS.CONTACT[0]).toEqual({ name: "email", required: true });
    expect(LEAD_FORM_FIELDS.CONTACT.some((field) => field.name === "phone")).toBe(false);
  });

  it("maps CMS texts to the contact form copy", () => {
    const texts = Object.fromEntries(TEXT_KEYS.map((key) => [key, `«${key}»`])) as Record<TextKey, string>;
    const copy = leadFormCopyFromTexts(texts);
    expect(copy.labels.message).toBe("«contacts.form.commentLabel»");
    expect(copy.labels.phone).toBe("«contacts.form.phoneLabel»");
    expect(copy.topics.PARTNERSHIP).toBe("«contacts.form.topics.partnership»");
    expect(copy.submit).toBe("«contacts.form.submit»");
  });

  it("offers every lead type exactly once as a topic", () => {
    expect(LEAD_TOPICS.map((topic) => topic.type).sort()).toEqual([...LEAD_TYPES].sort());
  });

  it("maps each topic of the «Тема» selector to its lead type and CMS label", () => {
    const texts = Object.fromEntries(TEXT_KEYS.map((key) => [key, `«${key}»`])) as Record<TextKey, string>;
    const copy = leadFormCopyFromTexts(texts);
    for (const topic of LEAD_TOPICS) expect(copy.topics[topic.type]).toBe(texts[topic.key]);
    expect(Object.fromEntries(LEAD_TOPICS.map((topic) => [topic.type, topic.key]))).toEqual({
      TAILORING: "contacts.form.topics.tailoring",
      PARTNERSHIP: "contacts.form.topics.partnership",
      CONTACT: "contacts.form.topics.contact",
    });
  });

  it("has a localized fallback label for every topic (messages forms.topics)", () => {
    for (const messages of [ru, en]) {
      for (const type of LEAD_TYPES) expect(messages.forms.topics[type].trim(), type).not.toBe("");
    }
    expect(ru.forms.topics.TAILORING).not.toBe(en.forms.topics.TAILORING);
  });

  it("keeps one display order and shows the phone only where e-mail is optional", () => {
    expect(leadFieldsFor("CONTACT").map((field) => field.name)).toEqual(["email", "name", "message"]);
    expect(leadFieldsFor("TAILORING").map((field) => field.name)).toEqual(["email", "name", "phone", "message"]);
    expect(leadFieldsFor("PARTNERSHIP").find((field) => field.name === "email")?.required).toBe(false);
    expect(leadFieldsFor("CONTACT").find((field) => field.name === "email")?.required).toBe(true);
  });
});

describe("lead intents", () => {
  it("accepts known types and normalizes the subject", () => {
    expect(parseLeadIntent({ type: "TAILORING", subject: "  Заказ:\n Худи  " })).toEqual({
      type: "TAILORING",
      subject: "Заказ: Худи",
    });
    expect(parseLeadIntent({ type: "CONTACT" })).toEqual({ type: "CONTACT", subject: "" });
    expect(parseLeadIntent({ type: "SPAM", subject: "x" })).toBeNull();
    expect(parseLeadIntent({ type: "CONTACT", subject: "x".repeat(500) })?.subject).toHaveLength(LEAD_SUBJECT_MAX);
  });

  it("round-trips through a cross-page link", () => {
    const href = leadIntentHref("/en", { type: "CONTACT", subject: "Order: Sign Hoodie — White" }, "lead-form");
    expect(href.startsWith("/en?topic=CONTACT&subject=")).toBe(true);
    expect(href.endsWith("#lead-form")).toBe(true);
    const search = href.slice(href.indexOf("?"), href.indexOf("#"));
    expect(leadIntentFromSearch(search)).toEqual({ type: "CONTACT", subject: "Order: Sign Hoodie — White" });
    expect(leadIntentFromSearch("?utm_source=x")).toBeNull();
    expect(leadIntentFromSearch("?topic=nope")).toBeNull();
  });

  it("builds a subject from a prefix and a name", () => {
    expect(leadSubject("Заказ:", "Худи «Знак»")).toBe("Заказ: Худи «Знак»");
    expect(leadSubject("", "Худи")).toBe("Худи");
    expect(leadSubject("Купон:", " ")).toBe("Купон:");
  });
});

describe("leadApiResponseSchema", () => {
  it("parses success and failure bodies", () => {
    expect(leadApiResponseSchema.safeParse({ ok: true, id: "abc" }).success).toBe(true);
    expect(
      leadApiResponseSchema.safeParse({
        ok: false,
        error: "invalid_form",
        message: "Проверьте поля формы",
        fieldErrors: { email: "Укажите корректный e-mail" },
      }).success,
    ).toBe(true);
    expect(leadApiResponseSchema.safeParse({ ok: false, error: "teapot", message: "?" }).success).toBe(false);
  });
});
