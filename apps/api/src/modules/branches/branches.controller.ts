import { Controller, Get } from '@nestjs/common';

import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { BranchesService, BranchView } from './branches.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /** The tenant's active selling locations (any authenticated role). */
  @Get()
  list(@TenantId() tenantId: string): Promise<BranchView[]> {
    return this.branchesService.list(tenantId);
  }
}
