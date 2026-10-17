import { describe, expect, it } from "vitest";
import { currentSectionId, fragmentId, withSectionHash } from "./locale-switch";

describe("currentSectionId", () => {
  const sections = [
    { id: "home", top: -2000 },
    { id: "catalog", top: -900 },
    { id: "about", top: 300 },
    { id: "tailoring", top: 1400 },
  ];

  it("is the last section whose top passed the reading line", () => {
    expect(currentSectionId(sections, 405)).toBe("about");
    expect(currentSectionId(sections, 200)).toBe("catalog");
  });

  it("is null before the first section", () => {
    expect(currentSectionId([{ id: "home", top: 100 }], 50)).toBeNull();
    expect(currentSectionId([], 400)).toBeNull();
  });
});

describe("withSectionHash", () => {
  it("adds the chapter to the other language's URL", () => {
    expect(withSectionHash("/en", "reviews")).toBe("/en#reviews");
    expect(withSectionHash("/", "lead-form")).toBe("/#lead-form");
    expect(withSectionHash("/en/catalog/menya-zapomnyat", "product-hoodie-white-logo")).toBe(
      "/en/catalog/menya-zapomnyat#product-hoodie-white-logo",
    );
  });

  it("opens the cover and unknown anchors at the top", () => {
    expect(withSectionHash("/en", "home", "home")).toBe("/en");
    expect(withSectionHash("/en", null)).toBe("/en");
    expect(withSectionHash("/en#old", "x y")).toBe("/en");
    expect(withSectionHash("/en", "javascript:alert(1)")).toBe("/en");
  });
});

describe("fragmentId", () => {
  it("reads plain anchors only", () => {
    expect(fragmentId("#contacts")).toBe("contacts");
    expect(fragmentId("")).toBeNull();
    expect(fragmentId("#")).toBeNull();
    expect(fragmentId("#%E0%A4%A")).toBeNull();
    expect(fragmentId("#a/b")).toBeNull();
  });
});
