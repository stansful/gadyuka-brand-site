import { describe, expect, it } from "vitest";
import { CHAPTER_ORDER, SECTION_ANCHORS, isRequiredKey } from "@/lib/content/registry";
import { ACTIVE_MAP, NAV } from "./nav";

/** Page position of an anchor: the cover first, then the chapters in CHAPTER_ORDER. */
function pagePosition(anchor: string): number {
  if (anchor === SECTION_ANCHORS.hero) return 0;
  const index = CHAPTER_ORDER.findIndex((id) => SECTION_ANCHORS[id] === anchor);
  return index < 0 ? -1 : index + 1;
}

describe("site menu", () => {
  it("has the owner's six items: Главная, Каталог, О нас, Индивидуальный пошив, Специальное предложение, Контакты", () => {
    expect(NAV.map((item) => item.anchor)).toEqual(["home", "catalog", "about", "tailoring", "offers", "contacts"]);
    expect(NAV.map((item) => item.key)).toEqual([
      "header.nav.home",
      "header.nav.catalog",
      "header.nav.about",
      "header.nav.tailoring",
      "header.nav.offers",
      "header.nav.contacts",
    ]);
  });

  it("follows the order of the sections on the page", () => {
    const positions = NAV.map((item) => pagePosition(item.anchor));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("highlights every menu section while it is on screen (scroll-spy), nothing elsewhere", () => {
    for (const item of NAV) expect(ACTIVE_MAP[item.anchor]).toBe(item.anchor);
    expect(ACTIVE_MAP[SECTION_ANCHORS.reviews] ?? null).toBeNull();
  });

  it("never saves a menu item empty", () => {
    expect(NAV.every((item) => isRequiredKey(item.key))).toBe(true);
  });
});
