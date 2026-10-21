import { ApiProperty } from '@nestjs/swagger';

import type { AdminMenuItemListResponse } from '~shared/contracts/content-entities';

import { MenuItemDetailsResponse } from '~usecases/admin/content/common/menu/menu-item-details.response';
import { MenuItemRecord } from '~usecases/admin/content/common/menu/menu-item.records';

/** GET /admin/menu-items: every menu item in the manual order. */
export class MenuItemListResponse implements AdminMenuItemListResponse {
  @ApiProperty({ type: [MenuItemDetailsResponse] })
  items: MenuItemDetailsResponse[];

  static of(records: readonly MenuItemRecord[]): MenuItemListResponse {
    return Object.assign(new MenuItemListResponse(), {
      items: records.map(record => MenuItemDetailsResponse.of(record)),
    });
  }
}
