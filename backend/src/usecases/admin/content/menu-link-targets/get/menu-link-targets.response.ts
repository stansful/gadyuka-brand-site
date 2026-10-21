import { ApiProperty } from '@nestjs/swagger';

import type { AdminMenuCollectionTarget, AdminMenuLinkTargetsResponse } from '~shared/contracts/content-entities';

import { MenuCollectionTargetResponse } from './menu-collection-target.response';

/** GET /admin/menu-items/link-targets: the collection pages of the menu form's link picker. */
export class MenuLinkTargetsResponse implements AdminMenuLinkTargetsResponse {
  @ApiProperty({ type: [MenuCollectionTargetResponse] })
  collections: AdminMenuCollectionTarget[];

  static of(collections: AdminMenuCollectionTarget[]): MenuLinkTargetsResponse {
    return Object.assign(new MenuLinkTargetsResponse(), { collections });
  }
}
