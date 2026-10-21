/** How a lead's personal data appears in a message: in full for the owner, masked in logs. */
export interface LeadMessagePresenter {
  name(value: string): string;
  phone(value: string): string;
  email(value: string): string;
  /** The visitor's message as quoted (cut to `limit` characters for the owner) */
  message(value: string, limit: number): string;
  /** Characters of the visitor's message to start fitting the Telegram limit with */
  readonly initialMessageLimit: number;
  /** Site origin for the admin link ("" = no link) */
  readonly siteUrl: string;
}
