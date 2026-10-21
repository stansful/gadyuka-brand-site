import { LocaleMap } from '~core/locales/locale-map';
import { DEFAULT_LOCALE, Locale } from '~core/locales/locale.enum';

import { LeadFormRules } from './lead-form.rules';
import { LeadPhoneNumber } from './lead-phone-number';
import { LeadType } from './lead-type';

/** A lead form that passed the checks (LeadFormRules + the field checks of the request). */
export interface CheckedLeadForm {
  readonly type: LeadType;
  readonly name: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly message?: string | null;
  readonly locale?: unknown;
}

interface LeadSubmissionFields {
  readonly type: LeadType;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly message: string;
  readonly locale: Locale;
}

/** A lead ready to be stored: trimmed, the phone normalized, missing values made explicit. */
export class LeadSubmission implements LeadSubmissionFields {
  readonly type: LeadType;
  readonly name: string;
  /** null when not given */
  readonly email: string | null;
  /** "+79001234567"; null when not given */
  readonly phone: string | null;
  /** "" when not given */
  readonly message: string;
  /** The page's language; anything unknown → the default locale */
  readonly locale: Locale;

  private constructor(fields: LeadSubmissionFields) {
    Object.assign(this, fields);
  }

  static fromCheckedForm(form: CheckedLeadForm): LeadSubmission {
    return new LeadSubmission({
      type: form.type,
      name: form.name.trim(),
      email: LeadSubmission.textOrNull(form.email),
      phone: LeadSubmission.phoneOrNull(form.phone),
      message: (form.message ?? '').trim(),
      locale: LocaleMap.isLocale(form.locale) ? form.locale : DEFAULT_LOCALE,
    });
  }

  private static textOrNull(value: string | null | undefined): string | null {
    return LeadFormRules.isBlank(value) ? null : (value ?? '').trim();
  }

  private static phoneOrNull(value: string | null | undefined): string | null {
    const text = LeadSubmission.textOrNull(value);
    return text === null ? null : (LeadPhoneNumber.findNormalized(text) ?? null);
  }
}
