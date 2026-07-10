import { Injectable } from '@nestjs/common';

import { CategoriesRepository, CategoryWithCount } from './categories.repository';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  list(tenantId: string): Promise<CategoryWithCount[]> {
    return this.categoriesRepository.findManyByTenant(tenantId);
  }
}
