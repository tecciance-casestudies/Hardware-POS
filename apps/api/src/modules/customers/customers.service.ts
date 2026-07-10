import { Injectable, NotFoundException } from '@nestjs/common';
import { Customer } from '@hardware-pos/database';
import type { Paginated } from '@hardware-pos/shared';

import { paginate } from '../../common/pagination';
import { CustomersRepository } from './customers.repository';
import { QueryCustomersDto } from './dto/query-customers.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly customersRepository: CustomersRepository) {}

  async list(tenantId: string, query: QueryCustomersDto): Promise<Paginated<Customer>> {
    const [items, total] = await this.customersRepository.search(
      tenantId,
      query.search,
      query.skip,
      query.take,
    );
    return paginate(items, total, query.page, query.pageSize);
  }

  async getById(tenantId: string, id: string): Promise<Customer> {
    const customer = await this.customersRepository.findByIdForTenant(tenantId, id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }
}
