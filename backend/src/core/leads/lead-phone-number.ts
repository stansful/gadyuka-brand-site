import { LEAD_LIMITS } from './lead.constants';

/**
 * A visitor's phone number as stored: E.164-like "+<digits>" (10–15 digits). Russian conveniences
 * without "+": "8 (900) 123-45-67" → "+79001234567", "900 123 45 67" → "+79001234567".
 */
export class LeadPhoneNumber {
  private static readonly ALLOWED_CHARACTERS = /^\+?[\d\s().-]+$/;
  private static readonly MIN_DIGITS = 10;
  private static readonly MAX_DIGITS = 15;
  /** "8 900 …": the Russian trunk prefix of an 11-digit number stands for the country code 7 */
  private static readonly TRUNK_NUMBER = { digits: 11, prefix: '8' } as const;
  /** "900 …": a 10-digit Russian mobile number without the country code */
  private static readonly LOCAL_MOBILE = { digits: 10, prefix: '9' } as const;
  private static readonly RUSSIA = '7';

  /** The normalized number, or undefined when `raw` cannot be a phone number. */
  static findNormalized(raw: string): string | undefined {
    const value = raw.trim();
    if (!LeadPhoneNumber.isPlausible(value)) {
      return undefined;
    }
    const digits = LeadPhoneNumber.withCountryCode(value);
    return LeadPhoneNumber.hasValidDigits(digits) ? `+${digits}` : undefined;
  }

  private static isPlausible(value: string): boolean {
    return value.length > 0 && value.length <= LEAD_LIMITS.phoneMax && LeadPhoneNumber.ALLOWED_CHARACTERS.test(value);
  }

  private static withCountryCode(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (value.startsWith('+')) {
      return digits;
    }
    const { TRUNK_NUMBER, LOCAL_MOBILE, RUSSIA } = LeadPhoneNumber;
    if (digits.length === TRUNK_NUMBER.digits && digits.startsWith(TRUNK_NUMBER.prefix)) {
      return `${RUSSIA}${digits.slice(1)}`;
    }
    const isLocalMobile = digits.length === LOCAL_MOBILE.digits && digits.startsWith(LOCAL_MOBILE.prefix);
    return isLocalMobile ? `${RUSSIA}${digits}` : digits;
  }

  private static hasValidDigits(digits: string): boolean {
    const { MIN_DIGITS, MAX_DIGITS } = LeadPhoneNumber;
    return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS && !digits.startsWith('0');
  }
}
