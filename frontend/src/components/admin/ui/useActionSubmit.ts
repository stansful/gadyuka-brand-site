'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';

import type { ActionResult, FieldErrors } from '@/lib/admin/action-result';

type RunOptions<T> = {
  onSuccess?: (data: T) => void;
  /** Overrides the action's own success message; false = no toast. */
  successMessage?: string | false;
};

/**
 * Runs a Server Action inside a transition: pending state, toasts (the action's own message,
 * or admin.ui.saved / admin.errors.network), field errors from the ActionResult.
 */
export function useActionSubmit(): {
  pending: boolean;
  fieldErrors: FieldErrors;
  setFieldErrors: (errors: FieldErrors) => void;
  run: <T>(action: () => Promise<ActionResult<T>>, options?: RunOptions<T>) => void;
} {
  const t = useTranslations('admin');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const run = useCallback(
    <T>(action: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) => {
      startTransition(async () => {
        let result: ActionResult<T>;
        try {
          result = await action();
        } catch {
          toast.error(t('errors.network'));
          return;
        }
        if (result.ok) {
          setFieldErrors({});
          const message =
            options.successMessage === undefined ? (result.message ?? t('ui.saved')) : options.successMessage;
          if (message) toast.success(message);
          options.onSuccess?.(result.data);
        } else {
          setFieldErrors(result.fieldErrors ?? {});
          toast.error(result.error);
        }
      });
    },
    [t],
  );

  return { pending, fieldErrors, setFieldErrors, run };
}
