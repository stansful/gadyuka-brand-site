import { Injectable } from '@nestjs/common';

import { Usecase } from '~usecases/usecase.interfaces';

import { ProductListRepository } from './product-list.repository';
import { ProductListResponse } from './product-list.response';

/** The products of the admin list, grouped by collection (drag & drop order within a collection). */
@Injectable()
export class ProductListUsecase implements Usecase<void, ProductListResponse> {
  constructor(private readonly repository: ProductListRepository) {}

  async execute(): Promise<ProductListResponse> {
    return ProductListResponse.of(await this.repository.findGroups());
  }
}
