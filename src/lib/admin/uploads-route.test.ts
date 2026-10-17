import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/uploads/[...path]/route";

/** The /uploads fallback file server must only ever serve raster images from UPLOAD_DIR. */
describe("GET /uploads/[...path]", () => {
  let root = "";
  let uploads = "";
  const previous = process.env.UPLOAD_DIR;

  const get = (segments: string[], headers: Record<string, string> = {}): Promise<Response> =>
    GET(new Request(`http://localhost/uploads/${segments.join("/")}`, { headers }), {
      params: Promise.resolve({ path: segments }),
    });

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "gadyuka-uploads-"));
    uploads = path.join(root, "uploads");
    await mkdir(path.join(uploads, "2026", "10"), { recursive: true });
    await writeFile(path.join(uploads, "2026", "10", "photo.webp"), Buffer.from("RIFF0000WEBPVP8 "));
    await writeFile(path.join(uploads, "evil.svg"), "<svg><script>alert(1)</script></svg>");
    await writeFile(path.join(uploads, "page.html"), "<script>alert(1)</script>");
    await writeFile(path.join(root, "secret.webp"), "secret");
    await symlink(path.join(root, "secret.webp"), path.join(uploads, "link.webp"));
    process.env.UPLOAD_DIR = uploads;
  });

  afterAll(async () => {
    process.env.UPLOAD_DIR = previous;
    await rm(root, { recursive: true, force: true });
  });

  it("serves an existing image with immutable caching and nosniff", async () => {
    const response = await get(["2026", "10", "photo.webp"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const etag = response.headers.get("etag");
    expect(etag).toBeTruthy();

    const cached = await get(["2026", "10", "photo.webp"], { "if-none-match": etag ?? "" });
    expect(cached.status).toBe(304);
  });

  it("returns 404 for traversal, hidden, missing, symlinked and non-image files", async () => {
    expect((await get(["..", "secret.webp"])).status).toBe(404);
    expect((await get(["2026", "..", "..", "secret.webp"])).status).toBe(404);
    expect((await get([".env"])).status).toBe(404);
    expect((await get(["missing.webp"])).status).toBe(404);
    expect((await get(["link.webp"])).status).toBe(404);
    expect((await get(["evil.svg"])).status).toBe(404);
    expect((await get(["page.html"])).status).toBe(404);
    expect((await get(["2026"])).status).toBe(404);
  });
});
