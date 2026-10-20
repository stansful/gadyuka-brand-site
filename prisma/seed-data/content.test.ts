import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import { CHAPTER_ORDER, chapterNumber, CONTENT_BLOCKS, CONTENT_SECTIONS, SECTION_ANCHORS } from "../../src/lib/content/registry";
import { CONTENT_COPY } from "./content";
import { SEED_COLLECTION, SEED_GALLERY, SEED_NEWS, SEED_OFFERS, SEED_PARTNERS, SEED_PRODUCTS, SEED_REVIEWS } from "./entities";

/**
 * Owner rule: the collection «Меня запомнят» is never described as first / debut / №1 —
 * in any language. Product numbers (#01…#04) are fine: they number products, not issues.
 */
const FORBIDDEN = [/перв/i, /дебют/i, /\bfirst\b/i, /\bdebut/i, /№\s*0*1\b/, /\bno\.?\s*0*1\b/i, /issue\s*#?\s*0*1\b/i];

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("seed copy", () => {
  it("never calls the collection first / debut / №1", () => {
    const all = strings([CONTENT_COPY, SEED_COLLECTION, SEED_PRODUCTS, SEED_REVIEWS, SEED_NEWS, SEED_GALLERY, SEED_OFFERS, SEED_PARTNERS, ru, en]);
    const offending = all.filter((text) => FORBIDDEN.some((pattern) => pattern.test(text)));
    expect(offending).toEqual([]);
  });

  it("has Russian and English for every text block", () => {
    for (const [key, copy] of Object.entries(CONTENT_COPY)) {
      expect(copy.ru.trim(), key).not.toBe("");
      expect(copy.en.trim(), key).not.toBe("");
    }
  });

  it("keeps placeholder partners as drafts (their name is the same in every language)", () => {
    expect(SEED_PARTNERS.every((partner) => !partner.published)).toBe(true);
  });

  it("translates the comic SFX", () => {
    expect(CONTENT_COPY["hero.sfx"].en).toMatch(/^HS+/);
    expect(CONTENT_COPY["about.sfx"].en).toBe("SHHH!");
    expect(CONTENT_COPY["tailoring.sfx"].en).toBe("SNIP!");
  });
});

describe("chapters", () => {
  it("follow the owner's order: Каталог → О нас → Пошив → Спецпредложения → Новости → Галерея → Отзывы → Партнёры → Контакты", () => {
    expect(CHAPTER_ORDER).toEqual(["catalog", "about", "tailoring", "offers", "news", "gallery", "reviews", "partners", "contacts"]);
    expect(chapterNumber("about")).toBe("02");
    expect(chapterNumber("tailoring")).toBe("03");
    expect(chapterNumber("offers")).toBe("04");
    expect(chapterNumber("reviews")).toBe("07");
    expect(chapterNumber("contacts")).toBe("09");
  });

  it("are listed in the admin «Контент» in the same order", () => {
    const listed = CONTENT_SECTIONS.map((section) => section.id).filter((id) => CHAPTER_ORDER.some((chapter) => chapter === id));
    expect(listed).toEqual([...CHAPTER_ORDER]);
  });

  it("are all anchored sections with content in the admin", () => {
    for (const id of CHAPTER_ORDER) {
      expect(SECTION_ANCHORS[id]).toBe(id);
      expect(Object.values(CONTENT_BLOCKS).some((block) => block.section === id)).toBe(true);
    }
    expect(CONTENT_SECTIONS.map((section) => section.id)).toEqual(expect.arrayContaining([...CHAPTER_ORDER]));
  });
});
