import { LeadMessagePresenter } from './lead-message.presenter';
import { TELEGRAM_DEFAULTS } from './telegram.constants';

/** The owner's notification: everything as entered. */
export class OwnerLeadMessagePresenter implements LeadMessagePresenter {
  readonly initialMessageLimit = TELEGRAM_DEFAULTS.maxUserMessageLength;

  constructor(readonly siteUrl: string) {}

  name(value: string): string {
    return value;
  }

  phone(value: string): string {
    return value;
  }

  email(value: string): string {
    return value;
  }

  message(value: string, limit: number): string {
    const characters = Array.from(value);
    return characters.length <= limit ? value : `${characters.slice(0, limit - 1).join('')}…`;
  }
}
