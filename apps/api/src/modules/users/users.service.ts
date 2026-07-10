import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import type { Paginated } from '@hardware-pos/shared';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { paginate } from '../../common/pagination';
import { CreateUserDto } from './dto/create-user.dto';
import { PublicUser, UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async list(tenantId: string, query: PaginationQueryDto): Promise<Paginated<PublicUser>> {
    const [items, total] = await this.usersRepository.findManyByTenant(
      tenantId,
      query.skip,
      query.take,
    );
    return paginate(items, total, query.page, query.pageSize);
  }

  async getById(tenantId: string, id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findByIdForTenant(tenantId, id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  /** TODO: hash the PIN, enforce role rules, and persist. */
  create(_tenantId: string, _dto: CreateUserDto): Promise<PublicUser> {
    throw new NotImplementedException('User creation is not implemented yet');
  }
}
