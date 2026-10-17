import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

const { blockText, offerExpiryCacheLife } = await import("./landing");

const now = new Date("2026-10-16T20:00:00.000Z");
const at = (minutes: number): Date => new Date(now.getTime() + minutes * 60_000);

describe("offerExpiryCacheLife", () => {
  it("keeps the regular profile without offers expiring within the hour", () => {
    expect(offerExpiryCacheLife([], now)).toBeNull();
    expect(offerExpiryCacheLife([{ validUntil: null }, { validUntil: at(90) }], now)).toBeNull();
  });

  it("revalidates right after the earliest upcoming expiry", () => {
    expect(offerExpiryCacheLife([{ validUntil: at(30) }, { validUntil: at(10) }, { validUntil: null }], now)).toEqual({
      stale: 300,
      revalidate: 10 * 60 + 1,
      expire: 86_400,
    });
  });

  it("never revalidates more often than once a minute", () => {
    expect(offerExpiryCacheLife([{ validUntil: new Date(now.getTime() + 5_000) }], now)?.revalidate).toBe(60);
  });
});

describe("blockText", () => {
  it("falls back to the default copy for registry keys without a DB row (not seeded yet)", () => {
    expect(blockText("common.chapter", undefined, "ru")).toBe("Глава");
    expect(blockText("common.chapter", undefined, "en")).toBe("Chapter");
  });

  it("shows an existing row as stored — also when an admin emptied it", () => {
    expect(blockText("common.chapter", { value: { ru: "Часть", en: "Part" } }, "en")).toBe("Part");
    expect(blockText("offers.fine", { value: {} }, "ru")).toBe("");
    expect(blockText("common.chapter", { value: { ru: "Часть" } }, "en")).toBe("Часть");
  });
});
