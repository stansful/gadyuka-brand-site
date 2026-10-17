import type { ReactElement } from "react";
import type { ImageRef } from "@/lib/content";
import { imgAttrs } from "./image-props";

type ContentImageProps = {
  image: ImageRef | null;
  /** data-edit-img key of an IMAGE ContentBlock (omit for entity images). */
  editKey?: string;
  /** `sizes` attribute for responsive loading. */
  sizes: string;
  className?: string;
  /** Above-the-fold images only. */
  priority?: boolean;
  /** Alt when the media has no alt text in this locale (wins over the default-locale alt). */
  fallbackAlt?: string;
};

/**
 * An optimized picture for a Media reference (next/image output, rendered on the server — see
 * imgAttrs); renders an empty, labelled frame when no media is set.
 */
export function ContentImage({
  image,
  editKey,
  sizes,
  className,
  priority = false,
  fallbackAlt = "",
}: ContentImageProps): ReactElement {
  if (!image) {
    return <div className={className} data-edit-img={editKey} data-empty="true" aria-hidden="true" />;
  }
  const attrs = imgAttrs({
    src: image.src,
    width: image.width,
    height: image.height,
    alt: image.alt || fallbackAlt || image.altDefault,
    sizes,
    className,
    priority,
  });
  // eslint-disable-next-line @next/next/no-img-element -- next/image's own attributes, computed on the server
  return <img {...attrs} alt={attrs.alt} data-nimg="1" data-edit-img={editKey} />;
}
