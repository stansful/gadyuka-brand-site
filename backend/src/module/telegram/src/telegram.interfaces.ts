import { LeadType } from '~core/leads/lead-type';

export type TelegramFetch = typeof globalThis.fetch;

/** Connection settings (TELEGRAM_* env, SITE_URL) and transport tuning. */
export interface TelegramOptions {
  readonly token: string;
  readonly chatId: string;
  /** TELEGRAM_DRY_RUN: no network, the lead counts as NOT delivered */
  readonly dryRun: boolean;
  /** Public site origin for the admin link; only https origins get one */
  readonly siteUrl: string;
  /** Production: a dry run is worth a loud warning */
  readonly isProduction: boolean;
  readonly timeoutMs?: number;
  readonly retries?: number;
}

export enum TelegramDeliveryStatus {
  SENT = 'sent',
  /** TELEGRAM_DRY_RUN=1: nothing was sent (and it is not a delivery) */
  DRY_RUN = 'dryRun',
  FAILED = 'failed',
}

/** `error` is owner-facing text (a telegram.errors.* message), stored as Lead.telegramError. */
export type TelegramSendResult =
  | { readonly status: TelegramDeliveryStatus.SENT }
  | { readonly status: TelegramDeliveryStatus.DRY_RUN }
  | { readonly status: TelegramDeliveryStatus.FAILED; readonly error: string };

/** The Lead fields the message needs (a Prisma Lead row satisfies it). */
export interface TelegramLead {
  readonly id: string;
  readonly type: LeadType;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly message: string;
  readonly locale: string;
  readonly createdAt: Date;
}
