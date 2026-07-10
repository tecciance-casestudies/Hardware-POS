import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByTenant(
    tenantId: string,
    skip: number,
    take: number,
  ): Promise<[AuditLog[], number]> {
    const where: Prisma.AuditLogWhereInput = { tenantId };

    return this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.auditLog.count({ where }),
    ]);
  }

  create(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }
}
