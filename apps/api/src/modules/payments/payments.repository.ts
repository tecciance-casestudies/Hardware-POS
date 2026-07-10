import { Injectable } from '@nestjs/common';
import { Payment } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySale(tenantId: string, saleId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { tenantId, saleId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findByIdForTenant(tenantId: string, id: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({ where: { id, tenantId } });
  }
}
