import { Injectable } from '@nestjs/common';

import { Usecase } from '~usecases/usecase.interfaces';

import { MenuLinkTargetsRepository } from './menu-link-targets.repository';
import { MenuLinkTargetsResponse } from './menu-link-targets.response';

/** Link suggestions of the menu form that come from the data: the collection pages. */
@Injectable()
export class MenuLinkTargetsUsecase implements Usecase<void, MenuLinkTargetsResponse> {
  constructor(private readonly repository: MenuLinkTargetsRepository) {}

  async execute(): Promise<MenuLinkTargetsResponse> {
    return MenuLinkTargetsResponse.of(await this.repository.findCollections());
  }
}
