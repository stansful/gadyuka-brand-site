import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildStoragePath,
  detectImageMime,
  MAX_CONCURRENT_IMAGE_JOBS,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  MediaValidationError,
  processImage,
  removeStoredFile,
  sanitizeOriginalName,
  storeProcessedImage,
  withImageJobSlot,
} from "./media";

async function makeImage(width: number, height: number, format: "png" | "jpeg" | "gif" | "webp" = "png"): Promise<Uint8Array> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 40 } } });
  const buffer = await image.toFormat(format).toBuffer();
  return new Uint8Array(buffer);
}

describe("detectImageMime (magic bytes)", () => {
  it("detects raster formats regardless of file name", async () => {
    expect(await detectImageMime(await makeImage(4, 4, "png"))).toBe("image/png");
    expect(await detectImageMime(await makeImage(4, 4, "jpeg"))).toBe("image/jpeg");
    expect(await detectImageMime(await makeImage(4, 4, "gif"))).toBe("image/gif");
    expect(await detectImageMime(await makeImage(4, 4, "webp"))).toBe("image/webp");
  });

  it("rejects SVG, HTML and other non-images", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    const pdf = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj\n");
    expect(await detectImageMime(svg)).toBeNull();
    expect(await detectImageMime(html)).toBeNull();
    expect(await detectImageMime(pdf)).toBeNull();
  });
});

describe("processImage", () => {
  it("converts to WebP and keeps dimensions of small images (no upscaling)", async () => {
    const result = await processImage(await makeImage(640, 480, "jpeg"));
    expect(result.mime).toBe("image/webp");
    expect(result.sourceMime).toBe("image/jpeg");
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(result.size).toBe(result.data.byteLength);
    expect(await detectImageMime(result.data)).toBe("image/webp");
  });

  it("fits large images inside 2400×2400 keeping the aspect ratio", async () => {
    const result = await processImage(await makeImage(4800, 1200, "png"));
    expect(result.width).toBe(MAX_IMAGE_DIMENSION);
    expect(result.height).toBe(600);
  });

  it("rejects SVG with a Russian message", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    await expect(processImage(svg)).rejects.toBeInstanceOf(MediaValidationError);
    await expect(processImage(svg)).rejects.toThrow(/Неподдерживаемый формат/);
  });

  it("rejects empty and oversized files", async () => {
    await expect(processImage(new Uint8Array())).rejects.toThrow("Файл пустой");
    await expect(processImage(new Uint8Array(MAX_UPLOAD_BYTES + 1))).rejects.toThrow(/больше 15 МБ/);
  });

  it("rejects a truncated image that only has valid magic bytes", async () => {
    const png = await makeImage(64, 64, "png");
    await expect(processImage(png.slice(0, 40))).rejects.toBeInstanceOf(MediaValidationError);
  });
});

describe("file names and storage paths", () => {
  it("builds random year/month paths that never contain user input", () => {
    const now = new Date(Date.UTC(2026, 9, 16));
    expect(buildStoragePath(now, "a1b2c3d4e5f60718293a4b5c")).toBe("2026/10/a1b2c3d4e5f60718293a4b5c.webp");
    expect(buildStoragePath(now)).toMatch(/^2026\/10\/[a-f0-9]{24}\.webp$/);
    expect(() => buildStoragePath(now, "../../etc/passwd")).toThrow();
  });

  it("sanitizes original names for display", () => {
    expect(sanitizeOriginalName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalName("C:\\Users\\me\\Фото худи.JPG")).toBe("Фото худи.JPG");
    expect(sanitizeOriginalName("bad\u0000name<script>.png")).toBe("badnamescript.png");
    expect(sanitizeOriginalName("   ")).toBe("image");
    expect(sanitizeOriginalName(`${"a".repeat(300)}.png`).length).toBe(200);
  });
});

describe("storeProcessedImage / removeStoredFile", () => {
  let dir = "";
  const previous = process.env.UPLOAD_DIR;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "gadyuka-media-"));
    process.env.UPLOAD_DIR = dir;
  });

  afterAll(async () => {
    process.env.UPLOAD_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  });

  it("writes inside UPLOAD_DIR and removes the file again", async () => {
    const image = await processImage(await makeImage(10, 10));
    const relative = await storeProcessedImage(image, new Date(Date.UTC(2026, 0, 5)));
    expect(relative).toMatch(/^2026\/01\/[a-f0-9]{24}\.webp$/);
    const absolute = path.join(dir, relative);
    expect((await readFile(absolute)).byteLength).toBe(image.size);

    await removeStoredFile(relative);
    await expect(stat(absolute)).rejects.toThrow();
    // Missing files and traversal attempts are ignored.
    await expect(removeStoredFile(relative)).resolves.toBeUndefined();
    await expect(removeStoredFile("../outside.webp")).resolves.toBeUndefined();
  });
});

describe("withImageJobSlot", () => {
  it(`runs at most ${MAX_CONCURRENT_IMAGE_JOBS} image jobs at once and drains the queue in order`, async () => {
    let running = 0;
    let peak = 0;
    const finished: number[] = [];
    const job = (id: number) => async (): Promise<number> => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      finished.push(id);
      return id;
    };
    const results = await Promise.all([1, 2, 3, 4, 5].map((id) => withImageJobSlot(job(id))));
    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(MAX_CONCURRENT_IMAGE_JOBS);
    expect(finished).toHaveLength(5);
  });

  it("releases the slot when a job fails", async () => {
    await expect(withImageJobSlot(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    const results = await Promise.all(
      Array.from({ length: MAX_CONCURRENT_IMAGE_JOBS + 1 }, (_, index) => withImageJobSlot(async () => index)),
    );
    expect(results).toHaveLength(MAX_CONCURRENT_IMAGE_JOBS + 1);
  });
});
