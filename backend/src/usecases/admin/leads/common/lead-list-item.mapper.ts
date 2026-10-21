import type { LeadListItem } from '~shared/contracts/leads';

import { LeadPreview } from '~core/leads/lead-preview';

import { LeadListItemRow } from './lead-list-item.row';

/** A lead row → the list item of the contract (the message as a one-line preview, dates as ISO). */
export class LeadListItemMapper {
  static toItem(row: LeadListItemRow): LeadListItem {
    const { id, type, status, name, email, phone, locale, telegramSent } = row;
    const preview = LeadPreview.of(row.message);
    const createdAt = row.createdAt.toISOString();
    return { id, type, status, name, email, phone, preview, locale, telegramSent, createdAt };
  }
}
