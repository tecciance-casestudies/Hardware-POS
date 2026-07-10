import { Injectable } from '@nestjs/common';
import { Prisma } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

/** Fields safe to return to clients (never expose pinHash). */
const publicUserSelect = {
  id: true,
  tenantId: true,
  branchId: true,
  role: true,
  name: true,
  email: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByTenant(
    tenantId: string,
    skip: number,
    take: number,
  ): Promise<[PublicUser[], number]> {
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { tenantId },
        select: publicUserSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);
  }

  findByIdForTenant(tenantId: string, id: string): Promise<PublicUser | null> {
    return this.prisma.user.findFirst({
      where: { id, tenantId },
      select: publicUserSelect,
    });
  }
}
