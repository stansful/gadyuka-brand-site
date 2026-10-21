import { Injectable } from '@nestjs/common';

import { MenuItemRepository } from '~usecases/admin/content/common/menu/menu-item.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { MenuItemListResponse } from './menu-item-list.response';

/** The admin's site menu (manual order). */
@Injectable()
export class MenuItemListUsecase implements Usecase<void, MenuItemListResponse> {
  constructor(private readonly repository: MenuItemRepository) {}

  async execute(): Promise<MenuItemListResponse> {
    return MenuItemListResponse.of(await this.repository.findList());
  }
}
