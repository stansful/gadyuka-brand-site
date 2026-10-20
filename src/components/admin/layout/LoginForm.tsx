'use client';

import { LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, type ReactElement } from 'react';

import { loginAction } from '@/lib/admin/actions/auth';
import { initialLoginState } from '@/lib/admin/login-state';

import { Button } from '../ui/Button';
import { describedBy, Field } from '../ui/Field';
import { TextInput } from '../ui/inputs';

/** Password form (works without JS too: plain form posting to a Server Action). */
export function LoginForm({ next }: { next: string }): ReactElement {
  const t = useTranslations('admin.auth');
  const [state, formAction, pending] = useActionState(loginAction, initialLoginState);
  const error = state.error ?? undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field htmlFor="admin-password" label={t('password')} error={error}>
        <TextInput
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          invalid={Boolean(error)}
          aria-describedby={describedBy('admin-password', null, error)}
          maxLength={512}
        />
      </Field>
      <Button type="submit" variant="primary" pending={pending} icon={<LogIn className="size-4" aria-hidden />}>
        {t('submit')}
      </Button>
    </form>
  );
}
