"use client";

import { clsx } from "clsx";
import { ImagePlus, X } from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";
import type { AdminMediaRef } from "@/lib/admin/types";
import { Button } from "../ui/Button";
import { MediaLibraryDialog } from "./MediaLibraryDialog";
import { MediaThumb } from "./MediaThumb";

export type MediaPickerProps = {
  id: string;
  label: ReactNode;
  value: AdminMediaRef | null;
  onChange: (next: AdminMediaRef | null) => void;
  hint?: ReactNode;
  error?: string;
  /** Required pickers have no «Убрать» button. */
  required?: boolean;
  /** Preview shape. */
  aspect?: "square" | "wide" | "portrait";
};

const aspects = {
  square: "aspect-square w-32",
  wide: "aspect-video w-48",
  portrait: "aspect-[3/4] w-28",
} as const;

/**
 * Single image field: preview + «Выбрать / Заменить» (media library dialog with upload) + «Убрать».
 * The error (and hint) is tied to both picker buttons via aria-describedby (aria-invalid is
 * not allowed on buttons), so it is read whenever the control gets focus, not only once.
 */
export function MediaPicker({ id, label, value, onChange, hint, error, required = false, aspect = "square" }: MediaPickerProps): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="text-sm font-medium text-fg/90">
        {label}
        {required ? (
          <span className="ml-0.5 text-beige" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={clsx(
            "relative shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beige",
            error && "ring-2 ring-red-fg/70",
          )}
          aria-label={value ? "Заменить изображение" : "Выбрать изображение"}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        >
          <MediaThumb media={value} className={aspects[aspect]} sizes="200px" />
        </button>
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<ImagePlus className="size-4" aria-hidden />}
            onClick={() => setOpen(true)}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          >
            {value ? "Заменить" : "Выбрать"}
          </Button>
          {value && !required ? (
            <Button size="sm" variant="ghost" icon={<X className="size-4" aria-hidden />} onClick={() => onChange(null)}>
              Убрать
            </Button>
          ) : null}
        </div>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-fg" role="alert">
          {error}
        </p>
      ) : null}
      <MediaLibraryDialog
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(selected) => {
          const first = selected[0];
          if (first) onChange({ id: first.id, url: first.url, width: first.width, height: first.height, alt: first.alt });
        }}
      />
    </div>
  );
}
