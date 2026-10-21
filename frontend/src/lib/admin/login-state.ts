/** useActionState state of the admin login form. */
export type LoginState = {
  /** Form-level error («Неверный логин или пароль», «Слишком много попыток…») */
  error: string | null;
  fieldErrors: { login?: string; password?: string };
  /** The login typed last (kept in the field after a failed attempt; the password never is) */
  login: string;
};

export const initialLoginState: LoginState = { error: null, fieldErrors: {}, login: '' };
