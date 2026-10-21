import { Prisma } from '~prisma-generated/prisma/client';

/** Prisma select of LeadListItemRow (list and detail). */
export const LEAD_LIST_ITEM_SELECT = {
  id: true,
  type: true,
  status: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  locale: true,
  telegramSent: true,
  createdAt: true,
} satisfies Prisma.LeadSelect;
