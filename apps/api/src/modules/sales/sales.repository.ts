import { Injectable } from '@nestjs/common';
import { Prisma, Product, Receipt, Sale, SyncStatus } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { ComputedLine, PersistSaleInput } from './sales.types';

export type SaleWithRelations = Prisma.SaleGetPayload<{
  include: { items: true; payments: true; customer: true };
}>;

const saleInclude = { items: true, payments: true, customer: true } as const;

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── reads ────────────────────────────────────────────────────────────────

  async findManyByTenant(
    tenantId: string,
    syncStatus: SyncStatus | undefined,
    skip: number,
    take: number,
  ): Promise<[Sale[], number]> {
    const where: Prisma.SaleWhereInput = { tenantId, ...(syncStatus ? { syncStatus } : {}) };
    return this.prisma.$transaction([
      this.prisma.sale.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.sale.count({ where }),
    ]);
  }

  findByIdForTenant(tenantId: string, id: string): Promise<SaleWithRelations | null> {
    return this.prisma.sale.findFirst({ where: { id, tenantId }, include: saleInclude });
  }

  findDraftWithItems(tenantId: string, id: string): Promise<SaleWithRelations | null> {
    return this.prisma.sale.findFirst({
      where: { id, tenantId, status: 'DRAFT' },
      include: saleInclude,
    });
  }

  findProductsByIds(tenantId: string, ids: string[]): Promise<Product[]> {
    return this.prisma.product.findMany({ where: { tenantId, id: { in: ids } } });
  }

  branchExists(tenantId: string, branchId: string): Promise<{ id: string } | null> {
    return this.prisma.branch.findFirst({ where: { id: branchId, tenantId }, select: { id: true } });
  }

  registerExists(tenantId: string, registerId: string): Promise<{ id: string } | null> {
    return this.prisma.register.findFirst({
      where: { id: registerId, tenantId },
      select: { id: true },
    });
  }

  customerExists(tenantId: string, customerId: string): Promise<{ id: string } | null> {
    return this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true },
    });
  }

  // ── writes ─────────────────────────────────────────────────────────────────

  /** Persist a new DRAFT sale (no payments, no sync job). */
  async createDraft(input: {
    tenantId: string;
    cashierId: string;
    branchId: string;
    registerId?: string | null;
    customerId?: string | null;
    computed: PersistSaleInput['computed'];
  }): Promise<SaleWithRelations> {
    const saleNumber = await this.nextSaleNumber(this.prisma, input.tenantId);
    const sale = await this.prisma.sale.create({
      data: {
        tenantId: input.tenantId,
        cashierId: input.cashierId,
        branchId: input.branchId,
        registerId: input.registerId ?? null,
        customerId: input.customerId ?? null,
        saleNumber,
        status: 'DRAFT',
        subtotal: input.computed.subtotal,
        totalDiscount: input.computed.totalDiscount,
        taxAmount: input.computed.taxAmount,
        total: input.computed.total,
        paidAmount: 0,
        balanceAmount: input.computed.total,
        paymentStatus: 'UNPAID',
        syncStatus: 'NOT_SYNCED',
        items: { create: input.computed.lines.map(toSaleItemCreate) },
      },
      include: saleInclude,
    });
    return sale;
  }

  /** Persist a new COMPLETED sale with payments and an outbound sync job. */
  async createCompleted(input: PersistSaleInput): Promise<SaleWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const saleNumber = await this.nextSaleNumber(tx, input.tenantId);
      const sale = await tx.sale.create({
        data: {
          tenantId: input.tenantId,
          cashierId: input.cashierId,
          branchId: input.branchId,
          registerId: input.registerId ?? null,
          customerId: input.customerId ?? null,
          saleNumber,
          status: 'COMPLETED',
          completedAt: new Date(),
          subtotal: input.computed.subtotal,
          totalDiscount: input.computed.totalDiscount,
          taxAmount: input.computed.taxAmount,
          total: input.computed.total,
          paidAmount: input.paidAmount,
          balanceAmount: input.balanceAmount,
          paymentStatus: input.paymentStatus,
          quickbooksDocumentType: input.quickbooksDocumentType,
          syncStatus: 'PENDING',
          items: { create: input.computed.lines.map(toSaleItemCreate) },
          payments: {
            create: input.payments.map((p) => ({
              tenantId: input.tenantId,
              method: p.method,
              amount: p.amount,
              reference: p.reference ?? null,
              syncStatus: 'NOT_SYNCED' as const,
            })),
          },
        },
        include: saleInclude,
      });
      await this.enqueueSaleSync(tx, input.tenantId, sale.id);
      return sale;
    });
  }

  /** Convert an existing DRAFT into a COMPLETED sale (items recomputed). */
  async completeDraft(
    tenantId: string,
    saleId: string,
    input: PersistSaleInput,
  ): Promise<SaleWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      await tx.saleItem.deleteMany({ where: { saleId } });
      const sale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          customerId: input.customerId ?? null,
          subtotal: input.computed.subtotal,
          totalDiscount: input.computed.totalDiscount,
          taxAmount: input.computed.taxAmount,
          total: input.computed.total,
          paidAmount: input.paidAmount,
          balanceAmount: input.balanceAmount,
          paymentStatus: input.paymentStatus,
          quickbooksDocumentType: input.quickbooksDocumentType,
          syncStatus: 'PENDING',
          items: { create: input.computed.lines.map(toSaleItemCreate) },
          payments: {
            create: input.payments.map((p) => ({
              tenantId,
              method: p.method,
              amount: p.amount,
              reference: p.reference ?? null,
              syncStatus: 'NOT_SYNCED' as const,
            })),
          },
        },
        include: saleInclude,
      });
      await this.enqueueSaleSync(tx, tenantId, sale.id);
      return sale;
    });
  }

  /**
   * MOCK QuickBooks push. Marks the sale + payments SYNCED, assigns mock QBO
   * document/payment ids, and closes the sync job. Real QBO calls come later.
   */
  async markSynced(sale: SaleWithRelations): Promise<SaleWithRelations> {
    const prefix = sale.quickbooksDocumentType === 'SALES_RECEIPT' ? 'SR' : 'INV';
    const qboDocId = sale.quickbooksDocumentId ?? `QBO-${prefix}-${sale.saleNumber}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: { syncStatus: 'SYNCED', quickbooksDocumentId: qboDocId, syncError: null },
      });
      for (const [i, p] of sale.payments.entries()) {
        await tx.payment.update({
          where: { id: p.id },
          data: {
            syncStatus: 'SYNCED',
            quickbooksPaymentId: p.quickbooksPaymentId ?? `QBO-PMT-${sale.saleNumber}-${i + 1}`,
          },
        });
      }
      await tx.syncJob.updateMany({
        where: {
          tenantId: sale.tenantId,
          entityType: 'SALE',
          entityId: sale.id,
          status: { in: ['PENDING', 'SYNCING', 'FAILED'] },
        },
        data: { status: 'SYNCED', completedAt: new Date() },
      });
      await tx.syncLog.create({
        data: {
          tenantId: sale.tenantId,
          entityType: 'SALE',
          entityId: sale.id,
          direction: 'OUTBOUND',
          status: 'SYNCED',
          message: `Mock QuickBooks sync: ${sale.quickbooksDocumentType} ${qboDocId}`,
        },
      });
      return tx.sale.findFirstOrThrow({ where: { id: sale.id }, include: saleInclude });
    });
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

  // ── helpers ──────────────────────────────────────────────────────────────

  private async nextSaleNumber(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
  ): Promise<string> {
    const count = await client.sale.count({ where: { tenantId } });
    return `S-${String(count + 1).padStart(6, '0')}`;
  }

  private async enqueueSaleSync(
    tx: Prisma.TransactionClient,
    tenantId: string,
    saleId: string,
  ): Promise<void> {
    await tx.syncJob.create({
      data: {
        tenantId,
        type: 'SALE_PUSH',
        direction: 'OUTBOUND',
        entityType: 'SALE',
        entityId: saleId,
        status: 'PENDING',
      },
    });
    await tx.syncLog.create({
      data: {
        tenantId,
        entityType: 'SALE',
        entityId: saleId,
        direction: 'OUTBOUND',
        status: 'PENDING',
        message: 'Sale queued for QuickBooks sync',
      },
    });
  }
}

function toSaleItemCreate(line: ComputedLine): Prisma.SaleItemCreateWithoutSaleInput {
  return {
    product: { connect: { id: line.productId } },
    productName: line.productName,
    sku: line.sku,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    discountType: line.discountType,
    discountValue: line.discountValue,
    discountAmount: line.discountAmount,
    discountReason: line.discountReason,
    ...(line.approvedByUserId
      ? { approvedBy: { connect: { id: line.approvedByUserId } } }
      : {}),
    taxAmount: line.taxAmount,
    lineSubtotal: line.lineSubtotal,
    lineTotal: line.lineTotal,
  };
}
