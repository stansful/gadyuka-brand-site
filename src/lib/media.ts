import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import {
  ACCEPTED_FORMATS_LABEL,
  isAcceptedImageMime,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  type AcceptedImageMime,
} from "@/lib/admin/media-constants";
import { resolveUploadPath } from "@/lib/uploads";

/**
 * Image upload pipeline (server-only, no DB access — see src/lib/admin/media-service.ts):
 *
 *   validate size → detect type by magic bytes (file-type) → sharp: auto-orient,
 *   fit inside 2400×2400 (no upscaling), strip metadata (EXIF/GPS), encode WebP →
 *   store as UPLOAD_DIR/<yyyy>/<mm>/<random>.webp
 *
 * The stored name is random (never derived from user input), so path traversal and
 * overwrites are impossible; resolveUploadPath() re-checks the final path anyway.
 */

export {
  ACCEPTED_IMAGE_MIME,
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  type AcceptedImageMime,
} from "@/lib/admin/media-constants";

/**
 * Decompression-bomb guard: refuse inputs above 40 megapixels (≈160 MB of decoded RGBA —
 * still far above any camera photo that fits into the 15 MB upload limit).
 */
export const MAX_INPUT_PIXELS = 40_000_000;
const WEBP_QUALITY = 82;

/**
 * At most this many sharp jobs run at once (each may hold a large decoded image); further
 * uploads wait in a FIFO queue, so parallel uploads cannot exhaust the VPS memory.
 */
export const MAX_CONCURRENT_IMAGE_JOBS = 2;
/** libvips worker threads per image (default = all CPU cores). */
sharp.concurrency(2);

let activeImageJobs = 0;
const waitingImageJobs: Array<() => void> = [];

/** Runs `job` when an image-processing slot is free (slots are handed over FIFO). */
export async function withImageJobSlot<T>(job: () => Promise<T>): Promise<T> {
  if (activeImageJobs < MAX_CONCURRENT_IMAGE_JOBS) {
    activeImageJobs += 1;
  } else {
    // The releasing job hands its slot over directly (activeImageJobs stays the same).
    await new Promise<void>((resolve) => waitingImageJobs.push(resolve));
  }
  try {
    return await job();
  } finally {
    const next = waitingImageJobs.shift();
    if (next) next();
    else activeImageJobs -= 1;
  }
}

/** Validation / processing failure with a Russian, user-facing message. */
export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

export type ProcessedImage = {
  data: Buffer;
  width: number;
  height: number;
  mime: "image/webp";
  size: number;
  sourceMime: AcceptedImageMime;
};

/** MIME type by magic bytes, or null when the file is not an accepted raster image. */
export async function detectImageMime(data: Uint8Array): Promise<AcceptedImageMime | null> {
  const detected = await fileTypeFromBuffer(data);
  if (!detected) return null;
  return isAcceptedImageMime(detected.mime) ? detected.mime : null;
}

/** Validates and converts an uploaded image to WebP. Throws MediaValidationError. */
export async function processImage(data: Uint8Array): Promise<ProcessedImage> {
  if (data.byteLength === 0) throw new MediaValidationError("Файл пустой");
  if (data.byteLength > MAX_UPLOAD_BYTES) {
    throw new MediaValidationError(`Файл больше ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ`);
  }
  const sourceMime = await detectImageMime(data);
  if (!sourceMime) {
    throw new MediaValidationError(`Неподдерживаемый формат. Можно загружать: ${ACCEPTED_FORMATS_LABEL}`);
  }

  try {
    const { data: output, info } = await withImageJobSlot(() =>
      sharp(data, {
        limitInputPixels: MAX_INPUT_PIXELS,
        failOn: "error",
        // Animated GIF/WebP: only the first frame is kept (the site shows still images).
        animated: false,
      })
        .autoOrient()
        .resize({
          width: MAX_IMAGE_DIMENSION,
          height: MAX_IMAGE_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer({ resolveWithObject: true }),
    );

    return { data: output, width: info.width, height: info.height, mime: "image/webp", size: output.byteLength, sourceMime };
  } catch (error: unknown) {
    console.warn("[media] sharp failed to process an upload:", error instanceof Error ? error.message : error);
    throw new MediaValidationError("Не удалось обработать изображение: файл повреждён или слишком большой");
  }
}

/**
 * Original file name for display only (never used on disk): no directories,
 * no control characters, NFC, at most 200 characters.
 */
export function sanitizeOriginalName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const limited = cleaned.length > 200 ? cleaned.slice(cleaned.length - 200) : cleaned;
  return limited.length > 0 ? limited : "image";
}

/** "2026/10/3f9c…e1.webp" — random 24-hex-char name under a year/month folder. */
export function buildStoragePath(now: Date, random: string = randomBytes(12).toString("hex")): string {
  if (!/^[a-f0-9]{8,64}$/.test(random)) throw new Error("Invalid random file id");
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${random}.webp`;
}

/** Writes the processed image into UPLOAD_DIR; returns its relative path (Media.path). */
export async function storeProcessedImage(image: ProcessedImage, now: Date = new Date()): Promise<string> {
  const relativePath = buildStoragePath(now);
  const absolutePath = resolveUploadPath(relativePath);
  if (!absolutePath) throw new Error(`Refusing to write outside UPLOAD_DIR: ${relativePath}`);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  // "wx": never overwrite an existing file.
  await writeFile(absolutePath, image.data, { flag: "wx" });
  return relativePath;
}

/** Deletes a stored file (Media.path). Missing files are ignored. */
export async function removeStoredFile(relativePath: string): Promise<void> {
  const absolutePath = resolveUploadPath(relativePath);
  if (!absolutePath) return;
  try {
    await unlink(absolutePath);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}
