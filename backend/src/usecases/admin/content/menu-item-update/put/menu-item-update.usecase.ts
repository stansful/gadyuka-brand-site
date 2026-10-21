import { Injectable, Logger } from '@nestjs/common';

import type { AdminMenuItemInput } from '~shared/contracts/content-entities';

import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { MenuItemFieldsFactory } from '~usecases/admin/content/common/menu/menu-item-fields.factory';
import { MenuItemRepository } from '~usecases/admin/content/common/menu/menu-item.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface MenuItemUpdateCommand extends AdminMenuItemInput {
  readonly id: string;
}

/** Saves the edit form of a menu item (its place in the menu stays). */
@Injectable()
export class MenuItemUpdateUsecase implements Usecase<MenuItemUpdateCommand, ContentEntitySavedResponse> {
  private readonly logger = new Logger(MenuItemUpdateUsecase.name);

  constructor(private readonly repository: MenuItemRepository) {}

  async execute(command: MenuItemUpdateCommand): Promise<ContentEntitySavedResponse> {
    await this.repository.update(command.id, MenuItemFieldsFactory.fromInput(command));
    this.logger.log('MenuItemUpdateUsecase : menu item saved', { menu_item_id: command.id });
    return ContentEntitySavedResponse.of(command.id);
  }
}
