import { Injectable } from '@nestjs/common';

import { MAX_ADMIN_LIST_ROWS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

import { MenuItemFields, MenuItemRecord } from './menu-item.records';

const MENU_ITEM_SELECT = {
  id: true,
  label: true,
  href: true,
  showInHeader: true,
  showInFooter: true,
  published: true,
} as const satisfies Prisma.MenuItemSelect;

type MenuItemRow = Prisma.MenuItemGetPayload<{ select: typeof MENU_ITEM_SELECT }>;

/** Items of the site menu (menu_items). */
@Injectable()
export class MenuItemRepository {
  constructor(private readonly database: DatabaseService) {}

  /** In the manual order (then the older first). */
  async findList(): Promise<MenuItemRecord[]> {
    const rows = await this.database.client.menuItem.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      take: MAX_ADMIN_LIST_ROWS,
      select: MENU_ITEM_SELECT,
    });
    return rows.map(row => this.toRecord(row));
  }

  async findById(id: string): Promise<MenuItemRecord | undefined> {
    const row = await this.database.client.menuItem.findUnique({ where: { id }, select: MENU_ITEM_SELECT });
    return row === null ? undefined : this.toRecord(row);
  }

  /** The highest order of the menu (null: no items yet). */
  async findMaxOrder(): Promise<number | null> {
    const result = await this.database.client.menuItem.aggregate({ _max: { order: true } });
    return result._max.order;
  }

  async create(fields: MenuItemFields, order: number): Promise<string> {
    const row = await this.database.client.menuItem.create({ data: { ...fields, order }, select: { id: true } });
    return row.id;
  }

  /** A missing row → Prisma P2025 → 404 notFound (ApiExceptionFilter). */
  async update(id: string, fields: MenuItemFields): Promise<void> {
    await this.database.client.menuItem.update({ where: { id }, data: fields, select: { id: true } });
  }

  private toRecord(row: MenuItemRow): MenuItemRecord {
    return { ...row, label: LocalizedTextValue.parse(row.label) };
  }
}
