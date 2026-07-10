import { Injectable } from '@nestjs/common';
import { Prisma, PrintJob, PrintJobStatus, PrintJobType, Receipt } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

export type SaleForReceipt = Prisma.SaleGetPayload<{
  include: {
    items: { include: { product: true } };
    payments: true;
    customer: true;
    tenant: true;
  };
}>;

@Injectable()
export class ReceiptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSaleForReceipt(tenantId: string, saleId: string): Promise<SaleForReceipt | null> {
    return this.prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        items: { include: { product: true } },
        payments: true,
        customer: true,
        tenant: true,
      },
    });
  }

  findReceiptBySale(tenantId: string, saleId: string): Promise<Receipt | null> {
    return this.prisma.receipt.findFirst({ where: { saleId, sale: { tenantId } } });
  }

  findReceiptById(tenantId: string, id: string): Promise<Receipt | null> {
    return this.prisma.receipt.findFirst({ where: { id, sale: { tenantId } } });
  }

  upsertReceipt(
    saleId: string,
    receiptNumber: string,
    content: Prisma.InputJsonValue,
  ): Promise<Receipt> {
    return this.prisma.receipt.upsert({
      where: { saleId },
      update: { content, printCount: { increment: 1 }, printedAt: new Date() },
      create: { saleId, receiptNumber, content, printCount: 1, printedAt: new Date() },
    });
  }

  createPrintJob(data: {
    tenantId: string;
    saleId: string;
    receiptId?: string | null;
    type: PrintJobType;
    html: string;
    createdByUserId?: string | null;
  }): Promise<PrintJob> {
    return this.prisma.printJob.create({ data });
  }

  async listPrintJobs(
    tenantId: string,
    filters: { saleId?: string; status?: PrintJobStatus; type?: PrintJobType },
    skip: number,
    take: number,
  ): Promise<[PrintJob[], number]> {
    const where: Prisma.PrintJobWhereInput = {
      tenantId,
      ...(filters.saleId ? { saleId: filters.saleId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.printJob.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.printJob.count({ where }),
    ]);
  }

  findPrintJob(tenantId: string, id: string): Promise<PrintJob | null> {
    return this.prisma.printJob.findFirst({ where: { id, tenantId } });
  }

  markPrinted(id: string): Promise<PrintJob> {
    return this.prisma.printJob.update({
      where: { id },
      data: { status: 'PRINTED', printedAt: new Date() },
    });
  }
}
