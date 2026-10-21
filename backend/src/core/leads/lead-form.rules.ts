import { LeadType } from './lead-type';

/** The fields of a submitted lead form the rules look at, as the visitor sent them (any JSON value). */
export interface LeadFormValues {
  readonly type?: unknown;
  readonly email?: unknown;
  readonly phone?: unknown;
  readonly message?: unknown;
  readonly hp?: unknown;
}

/**
 * Which checks of the lead form apply (ported from the site's validator, frontend src/lib/leads.ts):
 * - a filled honeypot skips everything: the submission is ignored (and answered like a success);
 * - an unknown type skips the other fields: only the type is reported;
 * - TAILORING / PARTNERSHIP: e-mail and phone are optional, but one of them is needed (`contact`);
 *   CONTACT: the e-mail is required, the phone optional.
 */
export class LeadFormRules {
  static readonly TYPES: readonly LeadType[] = Object.values(LeadType);

  /** Per type: the e-mail is required (else e-mail and phone are optional, but one of them is needed). */
  private static readonly REQUIRES_EMAIL: Readonly<Record<LeadType, boolean>> = {
    [LeadType.TAILORING]: false,
    [LeadType.PARTNERSHIP]: false,
    [LeadType.CONTACT]: true,
  };

  /** "", whitespace, null and undefined count as «not provided». */
  static isBlank(value: unknown): boolean {
    return value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0);
  }

  /** Anything but absent / null / "" in the honeypot: a bot. */
  static isHoneypotFilled(form: LeadFormValues): boolean {
    const { hp } = form;
    return hp !== undefined && hp !== null && (typeof hp !== 'string' || hp.length > 0);
  }

  /** The honeypot is absent or text (a null one is reported as an invalid form). */
  static isHoneypotWellFormed(form: LeadFormValues): boolean {
    return form.hp === undefined || typeof form.hp === 'string';
  }

  static isKnownType(value: unknown): value is LeadType {
    return typeof value === 'string' && (LeadFormRules.TYPES as readonly string[]).includes(value);
  }

  /** The type is checked unless the honeypot is filled. */
  static isTypeChecked(form: LeadFormValues): boolean {
    return !LeadFormRules.isHoneypotFilled(form);
  }

  /** The fields are checked when the honeypot is empty and the type is known. */
  static isFormChecked(form: LeadFormValues): boolean {
    return LeadFormRules.isTypeChecked(form) && LeadFormRules.isKnownType(form.type);
  }

  /** A type whose form requires the e-mail (CONTACT). */
  static isEmailRequired(form: LeadFormValues): boolean {
    return LeadFormRules.isKnownType(form.type) && LeadFormRules.REQUIRES_EMAIL[form.type];
  }

  /** A type whose form takes an e-mail or a phone (TAILORING, PARTNERSHIP). */
  static isEmailOrPhoneForm(form: LeadFormValues): boolean {
    return LeadFormRules.isKnownType(form.type) && !LeadFormRules.REQUIRES_EMAIL[form.type];
  }

  /** The e-mail is checked when required or given. */
  static isEmailChecked(form: LeadFormValues): boolean {
    const isNeeded = LeadFormRules.isEmailRequired(form) || !LeadFormRules.isBlank(form.email);
    return LeadFormRules.isFormChecked(form) && isNeeded;
  }

  /** The phone is optional everywhere: checked when given. */
  static isPhoneChecked(form: LeadFormValues): boolean {
    return LeadFormRules.isFormChecked(form) && !LeadFormRules.isBlank(form.phone);
  }

  /** The message is optional: checked unless null / absent. */
  static isMessageChecked(form: LeadFormValues): boolean {
    return LeadFormRules.isFormChecked(form) && form.message !== null && form.message !== undefined;
  }

  /** TAILORING / PARTNERSHIP need «e-mail or phone». */
  static isContactGroupChecked(form: LeadFormValues): boolean {
    return LeadFormRules.isFormChecked(form) && LeadFormRules.isEmailOrPhoneForm(form);
  }

  /** E-mail or phone given (a typed but invalid one has its own error). */
  static hasEmailOrPhone(form: LeadFormValues): boolean {
    return !LeadFormRules.isBlank(form.email) || !LeadFormRules.isBlank(form.phone);
  }

  /** Strings trimmed, any other value as is (for the field checks and the stored lead). */
  static trimmed(value: unknown): unknown {
    return typeof value === 'string' ? value.trim() : value;
  }
}
