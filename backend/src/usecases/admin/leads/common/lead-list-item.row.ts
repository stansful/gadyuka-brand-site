import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';

/** The columns of a lead the admin's list shows (LEAD_LIST_ITEM_SELECT of the repositories). */
export interface LeadListItemRow {
  readonly id: string;
  readonly type: LeadType;
  readonly status: LeadStatus;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly message: string;
  readonly locale: string;
  readonly telegramSent: boolean;
  readonly createdAt: Date;
}
