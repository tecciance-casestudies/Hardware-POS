import { Controller, Get, Param, Query } from '@nestjs/common';
import { Customer } from '@hardware-pos/database';
import type { Paginated } from '@hardware-pos/shared';

import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CustomersService } from './customers.service';
import { QueryCustomersDto } from './dto/query-customers.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query() query: QueryCustomersDto,
  ): Promise<Paginated<Customer>> {
    return this.customersService.list(tenantId, query);
  }

  @Get(':id')
  getById(@TenantId() tenantId: string, @Param('id') id: string): Promise<Customer> {
    return this.customersService.getById(tenantId, id);
  }
}
