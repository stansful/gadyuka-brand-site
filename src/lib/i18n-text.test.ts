import { describe, expect, it } from "vitest";
import {
  hasTranslation,
  localizedTextSchema,
  lt,
  missingLocales,
  parseLocalizedText,
  readText,
  requiredLocalizedTextSchema,
} from "./i18n-text";

describe("readText", () => {
  it("returns the requested locale", () => {
    expect(readText({ ru: "Каталог", en: "Catalog" }, "en")).toBe("Catalog");
  });

  it("falls back to ru when the translation is missing or blank", () => {
    expect(readText({ ru: "Каталог" }, "en")).toBe("Каталог");
    expect(readText({ ru: "Каталог", en: "   " }, "en")).toBe("Каталог");
  });

  it("can disable the fallback", () => {
    expect(readText({ ru: "Каталог" }, "en", { fallback: false })).toBe("");
  });

  it("tolerates malformed values", () => {
    expect(readText(null, "ru")).toBe("");
    expect(readText("plain string", "ru")).toBe("");
    expect(readText({ ru: 42, en: "Catalog" }, "ru")).toBe("");
    expect(readText({ ru: 42, en: "Catalog" }, "en")).toBe("Catalog");
  });
});

describe("parseLocalizedText", () => {
  it("drops unknown locales and non-string values", () => {
    expect(parseLocalizedText({ ru: "а", de: "b", en: 1 })).toEqual({ ru: "а" });
  });
});

describe("schemas", () => {
  it("trims and drops empty translations", () => {
    expect(localizedTextSchema.parse({ ru: "  Каталог ", en: "" })).toEqual({ ru: "Каталог" });
  });

  it("rejects unknown locales on write", () => {
    expect(localizedTextSchema.safeParse({ ru: "a", de: "b" }).success).toBe(false);
  });

  it("requires the default locale", () => {
    expect(requiredLocalizedTextSchema.safeParse({ en: "Catalog" }).success).toBe(false);
    expect(requiredLocalizedTextSchema.safeParse({ ru: "Каталог" }).success).toBe(true);
  });
});

describe("helpers", () => {
  it("lt() drops empty values", () => {
    expect(lt({ ru: "Да", en: " " })).toEqual({ ru: "Да" });
  });

  it("reports missing translations", () => {
    expect(missingLocales({ ru: "Да" })).toEqual(["en"]);
    expect(hasTranslation({ ru: "Да", en: "Yes" }, "en")).toBe(true);
  });
});
