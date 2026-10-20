'use server';

import { revalidateContent } from '@/lib/content/cache';
import { db } from '@/lib/db';

import { adminAction, errorFailure } from '../action-helpers';
import { actionFail, actionOk, type ActionResult } from '../action-result';
import { getAdminTranslations } from '../i18n-server';
import { idSchema, menuItemInputSchema, type MenuItemInput } from '../schemas';
import { parseInput } from '../validation';

/**
 * Create (id = null) or update a site menu item. A new item goes to the end of the menu;
 * the order, the publish toggle and deleting are the shared list actions (./entities.ts).
 */
export async function saveMenuItem(id: string | null, input: MenuItemInput): Promise<ActionResult<{ id: string }>> {
  return adminAction('saveMenuItem', async () => {
    const parsedId = id === null ? null : idSchema.safeParse(id);
    if (parsedId && !parsedId.success) return errorFailure('invalidId');
    const parsed = await parseInput(menuItemInputSchema, input);
    if (!parsed.success) return actionFail(parsed.message, parsed.fieldErrors);
    const data = parsed.data;
    const currentId = parsedId?.data ?? null;

    const fields = {
      label: data.label,
      href: data.href,
      showInHeader: data.showInHeader,
      showInFooter: data.showInFooter,
      published: data.published,
    };

    let savedId: string;
    if (currentId) {
      savedId = (await db.menuItem.update({ where: { id: currentId }, data: fields, select: { id: true } })).id;
    } else {
      const last = await db.menuItem.aggregate({ _max: { order: true } });
      savedId = (
        await db.menuItem.create({ data: { ...fields, order: (last._max.order ?? -1) + 1 }, select: { id: true } })
      ).id;
    }
    revalidateContent();
    const t = await getAdminTranslations('admin.menu');
    return actionOk({ id: savedId }, t(currentId ? 'saved' : 'created'));
  });
}
