import { ContactMasker } from './contact-masker';
import { LeadMessagePresenter } from './lead-message.presenter';
import { TELEGRAM_DEFAULTS } from './telegram.constants';

/** The dry-run preview written to the log: no personal data (masked contacts, no message text). */
export class PreviewLeadMessagePresenter implements LeadMessagePresenter {
  readonly initialMessageLimit = TELEGRAM_DEFAULTS.minUserMessageLength;
  readonly siteUrl = '';
  private readonly masker = new ContactMasker();

  name(value: string): string {
    return this.masker.maskName(value);
  }

  phone(value: string): string {
    return this.masker.maskPhone(value);
  }

  email(value: string): string {
    return this.masker.maskEmail(value);
  }

  message(value: string): string {
    return `[${Array.from(value).length} chars]`;
  }
}
