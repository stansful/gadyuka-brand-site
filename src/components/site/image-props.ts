import "server-only";
import { getImageProps } from "next/image";
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import type { ImgAttrs } from "./img-attrs";

type ImageInput = {
  src: string;
  width: number;
  height: number;
  alt: string;
  sizes: string;
  className?: string;
  style?: CSSProperties;
  /** In the first viewport (an LCP candidate): preloaded at high priority, never lazy. */
  priority?: boolean;
};

/**
 * next/image's <img> attributes (srcset, sizes, decoding, inline style — the same output as the
 * <Image> component), computed on the server with getImageProps: the page renders a plain
 * <img data-nimg="1">, so the next/image client component never ships. A priority picture is
 * preloaded (react-dom preload → <link rel=preload as=image imagesrcset> in the head).
 */
export function imgAttrs({ src, width, height, alt, sizes, className, style, priority = false }: ImageInput): ImgAttrs {
  const { props } = getImageProps({
    src,
    width,
    height,
    alt,
    sizes,
    className,
    style,
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : undefined,
  });
  const attrs: ImgAttrs = {
    src: props.src,
    srcSet: props.srcSet,
    sizes: props.sizes,
    width: typeof props.width === "number" ? props.width : undefined,
    height: typeof props.height === "number" ? props.height : undefined,
    alt,
    loading: props.loading === "eager" ? "eager" : "lazy",
    decoding: props.decoding === "sync" || props.decoding === "auto" ? props.decoding : "async",
    fetchPriority: priority ? "high" : undefined,
    className: props.className,
    style: props.style,
  };
  if (priority) preload(attrs.src, { as: "image", imageSrcSet: attrs.srcSet, imageSizes: attrs.sizes, fetchPriority: "high" });
  return attrs;
}
