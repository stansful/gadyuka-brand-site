import { Injectable } from '@nestjs/common';

import { EntityNotFoundException } from '~usecases/admin/entities/common/entity-not-found.exception';
import { Usecase } from '~usecases/usecase.interfaces';

import { ProductDetailsRepository } from './product-details.repository';
import { ProductDetailsResponse } from './product-details.response';

export interface ProductDetailsQuery {
  readonly id: string;
}

/** One product with its photos for its edit form (404 notFound when it does not exist). */
@Injectable()
export class ProductDetailsUsecase implements Usecase<ProductDetailsQuery, ProductDetailsResponse> {
  constructor(private readonly repository: ProductDetailsRepository) {}

  async execute({ id }: ProductDetailsQuery): Promise<ProductDetailsResponse> {
    const details = await this.repository.findById(id);
    if (details === null) {
      throw new EntityNotFoundException();
    }
    return ProductDetailsResponse.of(details);
  }
}
