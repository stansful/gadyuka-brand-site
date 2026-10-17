import { clsx } from "clsx";
import { ImageOff } from "lucide-react";
import Image from "next/image";
import type { ReactElement } from "react";
import type { AdminMediaRef } from "@/lib/admin/types";

/** Square (or custom aspect) thumbnail of a media file; placeholder when empty. */
export function MediaThumb({
  media,
  sizes = "96px",
  className,
  fit = "cover",
  label,
}: {
  media: AdminMediaRef | null;
  sizes?: string;
  className?: string;
  fit?: "cover" | "contain";
  /** Accessible text when the image is meaningful; decorative by default. */
  label?: string;
}): ReactElement {
  return (
    <div className={clsx("relative overflow-hidden rounded-md border border-line bg-raised", className)}>
      {media ? (
        <Image
          src={media.url}
          alt={label ?? ""}
          fill
          sizes={sizes}
          className={fit === "cover" ? "object-cover" : "object-contain"}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted/60">
          <ImageOff className="size-5" aria-hidden />
          <span className="sr-only">Нет изображения</span>
        </div>
      )}
    </div>
  );
}
