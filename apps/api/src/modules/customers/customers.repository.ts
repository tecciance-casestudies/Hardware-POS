import { Injectable } from '@nestjs/common';
import { Customer, Prisma } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    tenantId: string,
    search: string | undefined,
    skip: number,
    take: number,
  ): Promise<[Customer[], number]> {
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.$transaction([
      this.prisma.customer.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.customer.count({ where }),
    ]);
  }

  findByIdForTenant(tenantId: string, id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({ where: { id, tenantId } });
  }
}
