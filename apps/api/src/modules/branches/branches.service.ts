import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export interface BranchView {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  registers: { id: string; name: string; code: string }[];
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active branches with their active registers — the tenant's selling locations. */
  async list(tenantId: string): Promise<BranchView[]> {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        registers: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, code: true },
        },
      },
    });
    return branches;
  }
}
