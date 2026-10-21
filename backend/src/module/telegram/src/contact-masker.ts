/** Masks personal data for logs: "+79001234567" → "+7******4567", "ivan@mail.ru" → "i***@mail.ru". */
export class ContactMasker {
  private static readonly HIDDEN = '***';
  /** Digits of a phone shown at its start (the country code's first digit) and at its end. */
  private static readonly VISIBLE_LEADING_DIGITS = 1;
  private static readonly VISIBLE_PHONE_DIGITS = 4;
  /** Fewest asterisks of a masked phone, so a short number does not show how short it is. */
  private static readonly MIN_HIDDEN_DIGITS = 3;

  maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= ContactMasker.VISIBLE_PHONE_DIGITS) {
      return ContactMasker.HIDDEN;
    }
    const { VISIBLE_LEADING_DIGITS, VISIBLE_PHONE_DIGITS, MIN_HIDDEN_DIGITS } = ContactMasker;
    const hidden = '*'.repeat(
      Math.max(MIN_HIDDEN_DIGITS, digits.length - VISIBLE_LEADING_DIGITS - VISIBLE_PHONE_DIGITS),
    );
    return `+${digits.slice(0, VISIBLE_LEADING_DIGITS)}${hidden}${digits.slice(-VISIBLE_PHONE_DIGITS)}`;
  }

  maskEmail(email: string): string {
    const at = email.lastIndexOf('@');
    return at <= 0 ? ContactMasker.HIDDEN : `${email.slice(0, 1)}${ContactMasker.HIDDEN}${email.slice(at)}`;
  }

  /** "Иван Петров" → "И***". */
  maskName(name: string): string {
    const first = Array.from(name.trim())[0];
    return first === undefined ? ContactMasker.HIDDEN : `${first}${ContactMasker.HIDDEN}`;
  }
}
