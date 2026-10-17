/** Attributes of an optimized <img> (next/image's output), computed on the server — serializable. */
import type { CSSProperties } from "react";

export type ImgAttrs = {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  alt: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  className?: string;
  style?: CSSProperties;
};

/**
 * The gallery's opened picture is sized like the concept's raw <img>: as large as the viewport
 * allows (≤ 1240 px), never above its own pixel width. A srcset would otherwise shrink a small
 * source to its density-corrected intrinsic width. --ar = width / height (noir.css .lb__img).
 */
export type LightboxImageStyle = CSSProperties & Record<"--ar" | "--w", string>;

export function lightboxImageStyle(width: number, height: number): LightboxImageStyle {
  return { "--ar": String(width > 0 && height > 0 ? width / height : 1.5), "--w": `${Math.max(1, width)}px` };
}
