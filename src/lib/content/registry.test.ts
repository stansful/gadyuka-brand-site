import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_COPY, CONTENT_IMAGES } from "../../../prisma/seed-data/content";
import { locales } from "@/i18n/locales";
import { CHAPTER_ORDER, CONTENT_KEYS, CONTENT_SECTIONS, IMAGE_KEYS, TEXT_KEYS, isContentKey, isRequiredKey } from "./registry";

/**
 * Content key completeness: every block the public site renders is in the registry (→ listed
 * in the admin «Контент» screen, which reads the registry), has seed copy in every language,
 * and every registry block is actually rendered somewhere.
 */

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SITE_SOURCES = ["src/components/site", "src/app/[locale]", "src/lib/leads.ts", "src/lib/lead-form-config.ts", "src/lib/seo/json-ld.ts"];

function filesUnder(relative: string): string[] {
  const absolute = path.join(ROOT, relative);
  if (statSync(absolute).isFile()) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return filesUnder(child);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path.join(ROOT, child)] : [];
  });
}

const sources = SITE_SOURCES.flatMap(filesUnder).map((file) => ({ file: path.relative(ROOT, file), text: readFileSync(file, "utf8") }));
const sectionIds = CONTENT_SECTIONS.map((section) => section.id).join("|");
/** "about.advantages.0.title" — a quoted string that starts with a content section id. */
const KEY_LITERAL = new RegExp(`["'\`]((?:${sectionIds})\\.[A-Za-z0-9.]+)["'\`]`, "g");

describe("content registry ↔ site ↔ seed", () => {
  it("knows every content key the site references (data-edit, texts[…], key lists)", () => {
    const unknown: string[] = [];
    const seen = new Set<string>();
    for (const { file, text } of sources) {
      for (const match of text.matchAll(KEY_LITERAL)) {
        const key = match[1] ?? "";
        seen.add(key);
        if (!isContentKey(key)) unknown.push(`${file}: ${key}`);
      }
    }
    expect(unknown).toEqual([]);
    expect(seen.size).toBe(CONTENT_KEYS.length); // the scan really sees the site's keys
  });

  it("renders every registry key somewhere on the site (no dead admin fields)", () => {
    const all = sources.map((source) => source.text).join("\n");
    const unused = CONTENT_KEYS.filter((key) => !all.includes(`"${key}"`));
    expect(unused).toEqual([]);
  });

  it("has seed copy in every language for every text block, and nothing else", () => {
    const missing = TEXT_KEYS.flatMap((key) =>
      locales.filter((locale) => (CONTENT_COPY[key]?.[locale] ?? "").trim() === "").map((locale) => `${key}.${locale}`),
    );
    expect(missing).toEqual([]);
    expect(Object.keys(CONTENT_COPY).filter((key) => !TEXT_KEYS.some((textKey) => textKey === key))).toEqual([]);
  });

  it("has a seed image for every image block", () => {
    expect(Object.keys(CONTENT_IMAGES).sort()).toEqual([...IMAGE_KEYS].sort());
  });

  it("requires the headings and the menu (never saved empty in the admin)", () => {
    for (const chapter of CHAPTER_ORDER) expect(isRequiredKey(`${chapter}.title`), chapter).toBe(true);
    expect(TEXT_KEYS.filter((key) => key.startsWith("header.nav.")).every(isRequiredKey)).toBe(true);
    expect(isRequiredKey("hero.title")).toBe(true);
    expect(isRequiredKey("offers.fine")).toBe(false); // «пусто — не показывать»
    expect(IMAGE_KEYS.some(isRequiredKey)).toBe(false);
  });

  it("puts every block into a section the admin lists", () => {
    const listed = new Set<string>(CONTENT_SECTIONS.map((section) => section.id));
    expect(CONTENT_KEYS.filter((key) => !listed.has(key.split(".")[0] ?? ""))).toEqual([]);
  });

  it("never leaves English placeholders in the Russian copy or Russian in the English copy", () => {
    // Allowed in English: the logo word ГАДЮКА and the letter «Г» of the logo (proper names).
    const cyrillicInEn = TEXT_KEYS.filter((key) => /[А-Яа-яЁё]/.test(CONTENT_COPY[key].en.replace(/ГАДЮКА|«Г»/g, "")));
    expect(cyrillicInEn).toEqual([]);
    // Allowed in Russian: E-mail, brand-neutral examples like you@mail.ru, phone formats.
    const latinInRu = TEXT_KEYS.filter((key) => /[A-Za-z]{3,}/.test(CONTENT_COPY[key].ru.replace(/E-mail|[\w.]+@[\w.]+/g, "")));
    expect(latinInRu).toEqual([]);
  });
});
