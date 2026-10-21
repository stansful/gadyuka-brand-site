import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminMenuItemDetails } from '~shared/contracts/content-entities';

import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';

import { MenuItemRecord } from './menu-item.records';

/** A menu item (rows of GET /admin/menu-items, GET /admin/menu-items/:id). */
export class MenuItemDetailsResponse implements AdminMenuItemDetails {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty(LocalizedTextSchema.of('Name in the menu'))
  label: LocalizedText;

  @ApiProperty({ example: '#catalog' })
  href: string;

  @ApiProperty()
  showInHeader: boolean;

  @ApiProperty()
  showInFooter: boolean;

  @ApiProperty()
  published: boolean;

  static of({ id, label, href, showInHeader, showInFooter, published }: MenuItemRecord): MenuItemDetailsResponse {
    return Object.assign(new MenuItemDetailsResponse(), { id, label, href, showInHeader, showInFooter, published });
  }
}
