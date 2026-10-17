"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult, FieldErrors } from "@/lib/admin/action-result";

export const NETWORK_ERROR_MESSAGE = "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";

type RunOptions<T> = {
  onSuccess?: (data: T) => void;
  /** Overrides the action's own success message; false = no toast. */
  successMessage?: string | false;
};

/**
 * Runs a Server Action inside a transition: pending state, Russian toasts,
 * field errors from the ActionResult, network failures handled.
 */
export function useActionSubmit(): {
  pending: boolean;
  fieldErrors: FieldErrors;
  setFieldErrors: (errors: FieldErrors) => void;
  run: <T>(action: () => Promise<ActionResult<T>>, options?: RunOptions<T>) => void;
} {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const run = useCallback(<T,>(action: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) => {
    startTransition(async () => {
      let result: ActionResult<T>;
      try {
        result = await action();
      } catch {
        toast.error(NETWORK_ERROR_MESSAGE);
        return;
      }
      if (result.ok) {
        setFieldErrors({});
        const message = options.successMessage === undefined ? (result.message ?? "Сохранено") : options.successMessage;
        if (message) toast.success(message);
        options.onSuccess?.(result.data);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }, []);

  return { pending, fieldErrors, setFieldErrors, run };
}
