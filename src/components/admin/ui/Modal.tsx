"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Prevent closing with Esc / backdrop (e.g. while uploading). */
  locked?: boolean;
};

const widths: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-6xl",
};

const noopSubscribe = (): (() => void) => () => {};

/** False during SSR / hydration, true on the client (no setState-in-effect needed). */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Accessible modal on top of the native <dialog> (focus trap, Esc, inert background
 * come from showModal()). Closes on backdrop click.
 *
 * Rendered through a portal into <body>: pickers live inside entity <form>s, and a <dialog>
 * nested in a form makes its inputs form-associated — Enter in the media search would then
 * implicitly submit (save) the entity form behind the dialog. React still bubbles synthetic
 * events through portals along the component tree, so submit events from forms inside the
 * dialog are stopped here as well.
 */
export function Modal(props: ModalProps): ReactElement | null {
  const isClient = useIsClient();
  // Nothing to show on the server: a modal is closed until the user opens it.
  return isClient ? createPortal(<ModalDialog {...props} />, document.body) : null;
}

function ModalDialog({ open, onClose, title, description, children, footer, size = "md", locked = false }: ModalProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !locked) onClose();
      }}
      onSubmit={(event) => {
        // Never let a form inside the dialog submit a form that renders the dialog.
        event.stopPropagation();
      }}
      className={clsx(
        "m-auto max-h-[min(90dvh,900px)] w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-line-strong bg-panel p-0 text-fg shadow-2xl",
        widths[size],
      )}
    >
      {open ? (
        <div className="flex max-h-[min(90dvh,900px)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-fg">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={locked}
              className="-m-1 rounded-md p-1 text-muted hover:bg-raised-hi hover:text-fg disabled:opacity-40"
              aria-label="Закрыть"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
