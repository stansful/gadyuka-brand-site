"use client";

import { useCallback, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions (default true). */
  destructive?: boolean;
};

/**
 * Promise-based confirmation dialog:
 *   const [confirmDialog, confirm] = useConfirm();
 *   if (await confirm({ title: "Удалить товар?" })) { … }
 *   return <>{…}{confirmDialog}</>;
 */
export function useConfirm(): [ReactElement, (options: ConfirmOptions) => Promise<boolean>] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = (
    <Modal
      open={options !== null}
      onClose={() => settle(false)}
      title={options?.title ?? ""}
      description={options?.description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(false)}>
            {options?.cancelLabel ?? "Отмена"}
          </Button>
          <Button variant={options?.destructive === false ? "primary" : "danger"} onClick={() => settle(true)} autoFocus>
            {options?.confirmLabel ?? "Удалить"}
          </Button>
        </>
      }
    />
  );

  return [dialog, confirm];
}
