import { Controller, Get } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permission } from '../auth/permissions';
import { CategoriesService } from './categories.service';
import { CategoryWithCount } from './categories.repository';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions(Permission.PRODUCT_READ)
  list(@TenantId() tenantId: string): Promise<CategoryWithCount[]> {
    return this.categoriesService.list(tenantId);
  }
}
