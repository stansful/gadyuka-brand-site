/** The outcome of a Telegram notification as stored on the lead (Lead.telegramSent / telegramError). */
export interface LeadDelivery {
  readonly telegramSent: boolean;
  /** The owner-facing reason when not delivered (a telegram.errors.* text; a dry run is not a delivery) */
  readonly telegramError: string | null;
}

/** Stores the outcome of a notification on its lead. */
export interface ILeadDeliveryRepository {
  saveDelivery(leadId: string, delivery: LeadDelivery): Promise<void>;
}
