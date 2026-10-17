import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { defaultLocale, type Locale } from "@/i18n/locales";
import { readText } from "@/lib/i18n-text";
import { mediaPublicUrl } from "@/lib/media-url";
import type { ImageRef } from "./types";

/** Prisma `select` for every media relation the read layer exposes. */
export const mediaSelect = {
  id: true,
  path: true,
  width: true,
  height: true,
  mime: true,
  alt: true,
} as const satisfies Prisma.MediaSelect;

export type MediaRow = Prisma.MediaGetPayload<{ select: typeof mediaSelect }>;

export function toImageRef(media: MediaRow | null | undefined, locale: Locale): ImageRef | null {
  if (!media) return null;
  return {
    id: media.id,
    src: mediaPublicUrl(media.path),
    width: media.width,
    height: media.height,
    mime: media.mime,
    // No fallback here: a localized title passed as `fallbackAlt` must win over the Russian alt
    // on /en; the default-locale alt is kept separately as the last resort.
    alt: readText(media.alt, locale, { fallback: false }),
    altDefault: readText(media.alt, defaultLocale),
  };
}

/** Split a multi-line text into trimmed, non-empty lines. */
export function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Build a fully-populated record from a key list. */
export function recordFromKeys<K extends string, V>(keys: readonly K[], valueFor: (key: K) => V): Record<K, V> {
  const out: Partial<Record<K, V>> = {};
  for (const key of keys) out[key] = valueFor(key);
  // Every key was assigned above.
  return out as Record<K, V>;
}
