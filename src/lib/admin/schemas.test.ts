import { describe, expect, it } from "vitest";
import { errorFor } from "./action-result";
import { countRu } from "./labels";
import {
  endOfDayFromInput,
  newsDateFromInput,
  offerInputSchema,
  productInputSchema,
  reorderInputSchema,
  settingsInputSchema,
  slugSchema,
  toDateInputValue,
} from "./schemas";
import { slugify } from "./slug";
import { parseInput } from "./validation";

const baseProduct = {
  slug: "hoodie",
  collectionId: "c1",
  title: { ru: "Худи" },
  description: {},
  details: {},
  price: 12900,
  imageIds: ["m1", "m2"],
  published: true,
};

describe("slugs", () => {
  it("transliterates Russian titles", () => {
    expect(slugify("Меня запомнят")).toBe("menya-zapomnyat");
    expect(slugify("Худи «Знак», белое")).toBe("hudi-znak-beloe");
    expect(slugify("  Поп-ап в Краснодаре — 2026!  ")).toBe("pop-ap-v-krasnodare-2026");
    expect(slugify("Ёжик щёки")).toBe("ezhik-scheki");
  });

  it("validates slugs", () => {
    expect(slugSchema.parse(" Menya-Zapomnyat ")).toBe("menya-zapomnyat");
    expect(slugSchema.safeParse("два слова").success).toBe(false);
    expect(slugSchema.safeParse("-edge-").success).toBe(false);
    expect(slugSchema.safeParse("a--b").success).toBe(false);
  });
});

describe("entity schemas", () => {
  it("requires the Russian title and drops empty translations", () => {
    const ok = parseInput(productInputSchema, { ...baseProduct, title: { ru: " Худи ", en: "" } });
    expect(ok.success && ok.data.title).toEqual({ ru: "Худи" });

    const missingRu = parseInput(productInputSchema, { ...baseProduct, title: { en: "Hoodie" } });
    expect(missingRu.success).toBe(false);
    if (!missingRu.success) expect(errorFor(missingRu.fieldErrors, "title")).toMatch(/ru/);
  });

  it("reports per-locale length errors as <field>.<locale>", () => {
    const result = parseInput(productInputSchema, { ...baseProduct, title: { ru: "Худи", en: "x".repeat(201) } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors["title.en"]).toBe("Не длиннее 200 символов");
  });

  it("validates prices and image lists", () => {
    expect(parseInput(productInputSchema, { ...baseProduct, price: null }).success).toBe(true);
    expect(parseInput(productInputSchema, { ...baseProduct, price: -1 }).success).toBe(false);
    expect(parseInput(productInputSchema, { ...baseProduct, price: 10.5 }).success).toBe(false);
    expect(parseInput(productInputSchema, { ...baseProduct, imageIds: ["m1", "m1"] }).success).toBe(false);
  });

  it("rejects unknown locales and javascript: links", () => {
    expect(parseInput(productInputSchema, { ...baseProduct, title: { ru: "Худи", de: "Hoodie" } }).success).toBe(false);
    const offer = { title: { ru: "Скидка" }, text: {}, badge: {}, ctaLabel: { ru: "Купить" }, validUntil: null, imageId: null, published: true };
    expect(parseInput(offerInputSchema, { ...offer, ctaHref: "javascript:alert(1)" }).success).toBe(false);
    expect(parseInput(offerInputSchema, { ...offer, ctaHref: "//evil.example" }).success).toBe(false);
    for (const href of ["#contacts", "/en#tailoring", "https://t.me/gadyuka", "mailto:hi@example.ru", "tel:+79000000000"]) {
      expect(parseInput(offerInputSchema, { ...offer, ctaHref: href }).success).toBe(true);
    }
  });

  it("validates settings with Russian messages", () => {
    const base = { phone: "+7 (900) 000-00-00", email: "", address: {}, socials: [], seoTitle: {}, seoDescription: {}, ogImageId: null };
    expect(parseInput(settingsInputSchema, base).success).toBe(true);
    const bad = parseInput(settingsInputSchema, {
      ...base,
      email: "nope",
      socials: [{ type: "telegram", url: "ftp://x" }],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.fieldErrors.email).toBe("Некорректный e-mail");
      expect(bad.fieldErrors["socials.0.url"]).toMatch(/https/);
    }
  });

  it("rejects duplicate ids in a reorder request", () => {
    expect(reorderInputSchema.safeParse({ entity: "review", ids: ["a", "b"] }).success).toBe(true);
    expect(reorderInputSchema.safeParse({ entity: "review", ids: ["a", "a"] }).success).toBe(false);
    expect(reorderInputSchema.safeParse({ entity: "lead", ids: ["a"] }).success).toBe(false);
  });

  it("uses Russian default messages for generic zod errors", () => {
    const result = parseInput(productInputSchema, { ...baseProduct, published: "yes" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.published).toMatch(/[А-Яа-я]/);
  });
});

describe("Moscow dates", () => {
  it("round-trips news and offer dates through <input type=date>", () => {
    expect(toDateInputValue(newsDateFromInput("2026-10-01"))).toBe("2026-10-01");
    const until = endOfDayFromInput("2026-10-31");
    expect(toDateInputValue(until)).toBe("2026-10-31");
    expect(until.toISOString()).toBe("2026-10-31T20:59:59.999Z");
  });
});

describe("countRu", () => {
  it("pluralizes", () => {
    expect(countRu(1, "товар", "товара", "товаров")).toBe("1 товар");
    expect(countRu(3, "товар", "товара", "товаров")).toBe("3 товара");
    expect(countRu(11, "товар", "товара", "товаров")).toBe("11 товаров");
    expect(countRu(22, "товар", "товара", "товаров")).toBe("22 товара");
  });
});
