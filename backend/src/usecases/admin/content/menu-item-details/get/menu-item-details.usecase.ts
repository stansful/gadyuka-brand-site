import { Injectable } from '@nestjs/common';

import { ContentEntityNotFoundException } from '~usecases/admin/content/common/exceptions/content-entity-not-found.exception';
import { MenuItemDetailsResponse } from '~usecases/admin/content/common/menu/menu-item-details.response';
import { MenuItemRepository } from '~usecases/admin/content/common/menu/menu-item.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface MenuItemDetailsQuery {
  readonly id: string;
}

/** One menu item for the edit form. */
@Injectable()
export class MenuItemDetailsUsecase implements Usecase<MenuItemDetailsQuery, MenuItemDetailsResponse> {
  constructor(private readonly repository: MenuItemRepository) {}

  async execute({ id }: MenuItemDetailsQuery): Promise<MenuItemDetailsResponse> {
    const record = await this.repository.findById(id);
    if (record === undefined) {
      throw new ContentEntityNotFoundException();
    }
    return MenuItemDetailsResponse.of(record);
  }
}
