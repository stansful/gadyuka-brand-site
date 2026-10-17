import { describe, expect, it } from "vitest";
import { brandAssetUrl, mediaPublicUrl } from "./media-url";
import { resolveUploadPath } from "./uploads";

describe("mediaPublicUrl", () => {
  it("prefixes /uploads and encodes segments", () => {
    expect(mediaPublicUrl("seed/hoodie-white-logo.webp")).toBe("/uploads/seed/hoodie-white-logo.webp");
    expect(mediaPublicUrl("/seed/a b.webp")).toBe("/uploads/seed/a%20b.webp");
  });

  it("builds brand asset urls", () => {
    expect(brandAssetUrl("logo-black-ink.svg", {})).toBe("/brand/logo-black-ink.svg");
    expect(brandAssetUrl("/wordmark-ink.svg", {})).toBe("/brand/wordmark-ink.svg");
  });

  it("versions brand asset urls by content hash", () => {
    const versions = { "logo-black-ink.svg": "Ab3_-x9Zq0" };
    expect(brandAssetUrl("logo-black-ink.svg", versions)).toBe("/brand/logo-black-ink.svg?v=Ab3_-x9Zq0");
    expect(brandAssetUrl("hood.svg", versions)).toBe("/brand/hood.svg");
  });
});

describe("resolveUploadPath", () => {
  it("resolves files inside UPLOAD_DIR", () => {
    expect(resolveUploadPath("seed/a.webp")).toMatch(/uploads[\\/]seed[\\/]a\.webp$/);
  });

  it("rejects traversal and hidden files", () => {
    expect(resolveUploadPath("../.env")).toBeNull();
    expect(resolveUploadPath("seed/../../x")).toBeNull();
    expect(resolveUploadPath(".env")).toBeNull();
    expect(resolveUploadPath("/etc/passwd")).toBeNull();
  });
});
