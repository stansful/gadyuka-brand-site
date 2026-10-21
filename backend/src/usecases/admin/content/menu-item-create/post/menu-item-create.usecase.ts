import { Injectable, Logger } from '@nestjs/common';

import type { AdminMenuItemInput } from '~shared/contracts/content-entities';

import { ListPosition } from '~core/entities/list-position';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { MenuItemFieldsFactory } from '~usecases/admin/content/common/menu/menu-item-fields.factory';
import { MenuItemRepository } from '~usecases/admin/content/common/menu/menu-item.repository';
import { Usecase } from '~usecases/usecase.interfaces';

/** Adds an item to the end of the site menu. */
@Injectable()
export class MenuItemCreateUsecase implements Usecase<AdminMenuItemInput, ContentEntitySavedResponse> {
  private readonly logger = new Logger(MenuItemCreateUsecase.name);

  constructor(private readonly repository: MenuItemRepository) {}

  async execute(input: AdminMenuItemInput): Promise<ContentEntitySavedResponse> {
    const order = ListPosition.after(await this.repository.findMaxOrder());
    const id = await this.repository.create(MenuItemFieldsFactory.fromInput(input), order);
    this.logger.log('MenuItemCreateUsecase : menu item created', { menu_item_id: id });
    return ContentEntitySavedResponse.of(id);
  }
}
