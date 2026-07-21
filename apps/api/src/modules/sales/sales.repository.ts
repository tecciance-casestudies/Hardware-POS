import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Product } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { SyncQueueService } from '../sync/queue/sync-queue.service';
import { ComputedLine, PersistSaleInput, SalesListFilter } from './sales.types';

export type SaleWithRelations = Prisma.SaleGetPayload<{
  include: {
    items: true;
    payments: true;
    customer: true;
    branch: { select: { id: true; name: true; code: true; address: true; phone: true } };
    register: { select: { id: true; name: true; code: true } };
    cashier: { select: { id: true; name: true } };
  };
}>;

/** Sale row for the history list: base fields + names, payment methods, item count. */
export type SaleListRow = Prisma.SaleGetPayload<{
  include: {
    customer: { select: { name: true } };
    cashier: { select: { name: true } };
    payments: { select: { method: true } };
    _count: { select: { items: true } };
  };
}>;

const saleInclude = {
  items: true,
  payments: true,
  customer: true,
  branch: { select: { id: true, name: true, code: true, address: true, phone: true } },
  register: { select: { id: true, name: true, code: true } },
  cashier: { select: { id: true, name: true } },
} as const;

const saleListInclude = {
  customer: { select: { name: true } },
  cashier: { select: { name: true } },
  payments: { select: { method: true } },
  _count: { select: { items: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncQueue: SyncQueueService,
  ) {}

  // ── reads ────────────────────────────────────────────────────────────────

  async findManyByTenant(
    tenantId: string,
    filter: SalesListFilter,
    skip: number,
    take: number,
  ): Promise<[SaleListRow[], number]> {
    const where: Prisma.SaleWhereInput = {
      tenantId,
      ...(filter.syncStatus ? { syncStatus: filter.syncStatus } : {}),
      ...(filter.paymentStatus ? { paymentStatus: filter.paymentStatus } : {}),
      ...(filter.dateFrom || filter.dateTo
        ? {
            createdAt: {
              ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
              ...(filter.dateTo ? { lte: filter.dateTo } : {}),
            },
          }
        : {}),
      ...(filter.search
        ? {
            OR: [
              { saleNumber: { contains: filter.search, mode: 'insensitive' } },
              { customer: { is: { name: { contains: filter.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: saleListInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
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

  /**
   * A customer's credit terms plus how much they currently owe (sum of unpaid
   * balances on their completed sales). Used to enforce the credit limit before
   * a new credit/partial sale is accepted.
   */
  async getCustomerCredit(
    tenantId: string,
    customerId: string,
  ): Promise<{ creditAllowed: boolean; creditLimit: number | null; outstanding: number } | null> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { creditAllowed: true, creditLimit: true },
    });
    if (!customer) return null;

    const agg = await this.prisma.sale.aggregate({
      where: {
        tenantId,
        customerId,
        status: 'COMPLETED',
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
      },
      _sum: { balanceAmount: true },
    });

    return {
      creditAllowed: customer.creditAllowed,
      creditLimit: customer.creditLimit != null ? Number(customer.creditLimit) : null,
      outstanding: agg._sum.balanceAmount != null ? Number(agg._sum.balanceAmount) : 0,
    };
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
        orderDiscountType: input.computed.orderDiscountType,
        orderDiscountValue: input.computed.orderDiscountValue,
        orderDiscountAmount: input.computed.orderDiscountAmount,
        orderDiscountReason: input.computed.orderDiscountReason,
        orderDiscountApprovedById: input.computed.orderDiscountApprovedById,
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
          ...orderDiscountData(input.computed),
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
      await this.decrementStock(tx, input.tenantId, input.computed.lines);
      await this.syncQueue.enqueueSaleSync(tx, input.tenantId, sale.id);
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
          ...orderDiscountData(input.computed),
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
      await this.decrementStock(tx, tenantId, input.computed.lines);
      await this.syncQueue.enqueueSaleSync(tx, tenantId, sale.id);
      return sale;
    });
  }

  /**
   * Decrement on-hand stock for tracked products within the sale transaction.
   * The conditional update is the authoritative guard against overselling under
   * concurrency; a zero-row update rolls the whole sale back.
   */
  private async decrementStock(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: ComputedLine[],
  ): Promise<void> {
    // Aggregate per product: a cart may repeat the same productId across lines.
    const totals = new Map<string, { name: string; qty: number }>();
    for (const line of lines) {
      if (!line.trackInventory) continue;
      const prev = totals.get(line.productId);
      totals.set(line.productId, {
        name: line.productName,
        qty: (prev?.qty ?? 0) + line.quantity,
      });
    }
    for (const [productId, { name, qty }] of totals) {
      const res = await tx.product.updateMany({
        where: { id: productId, tenantId, quantityOnHand: { gte: qty } },
        data: { quantityOnHand: { decrement: qty } },
      });
      if (res.count === 0) {
        throw new BadRequestException(`Insufficient stock for ${name}`);
      }
    }
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

  // ── helpers ──────────────────────────────────────────────────────────────

  private async nextSaleNumber(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
  ): Promise<string> {
    const count = await client.sale.count({ where: { tenantId } });
    return `S-${String(count + 1).padStart(6, '0')}`;
  }
}

/** Order-level discount columns shared by the completed-sale writers. */
function orderDiscountData(computed: PersistSaleInput['computed']) {
  return {
    orderDiscountType: computed.orderDiscountType,
    orderDiscountValue: computed.orderDiscountValue,
    orderDiscountAmount: computed.orderDiscountAmount,
    orderDiscountReason: computed.orderDiscountReason,
    orderDiscountApprovedById: computed.orderDiscountApprovedById,
  };
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
