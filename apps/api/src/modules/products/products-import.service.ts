import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@hardware-pos/database';
import * as ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';
import { CreateProductDto, type ProductType } from './dto/create-product.dto';

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
}

/** Header names exactly as in the QuickBooks Products & Services template. */
const H = {
  name: 'Product/service name',
  category: 'Category',
  type: 'Item type',
  sku: 'SKU',
  salesDescription: 'Sales description',
  salesPrice: 'Sales price/rate',
  incomeAccount: 'Income account',
  purchaseDescription: 'Purchase description',
  purchaseCost: 'Purchase cost',
  expenseAccount: 'Expense account',
  quantityOnHand: 'Quantity on hand',
  quantityAsOfDate: 'Quantity as of date',
  reorderPoint: 'Reorder point',
  inventoryAssetAccount: 'Inventory asset account',
} as const;

type CellValue = ExcelJS.CellValue;

/** Collapse exceljs cell values (formula results, rich text, dates) to a primitive. */
function plain(v: CellValue): string | number | Date {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as { result?: CellValue; text?: string; richText?: Array<{ text: string }> };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.result != null) return plain(o.result);
    if (o.text != null) return o.text;
    return '';
  }
  return v as string | number;
}

function asText(v: string | number | Date): string {
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function asNumber(v: string | number | Date): number | undefined {
  const s = asText(v).replace(/,/g, '');
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse a "Quantity as of date" cell: a Date cell, M/D/YYYY, or YYYY-MM-DD. */
function asDate(v: string | number | Date): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  const s = asText(v);
  if (!s) return undefined;
  const mdY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = mdY ? new Date(Number(mdY[3]), Number(mdY[1]) - 1, Number(mdY[2])) : new Date(s);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Normalise the "Item type" column: Inventory / Non-Inventory / Service. */
function asItemType(v: string | number | Date): ProductType {
  const key = asText(v).toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'noninventory') return 'NonInventory';
  if (key === 'service') return 'Service';
  return 'Inventory';
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Bulk product import from the QuickBooks Products & Services template
 * (.xlsx or .csv). Rows are matched to existing products by SKU (or exact
 * name when the row has no SKU) and upserted through the products service, so
 * QuickBooks pushes queue exactly as they would for manual edits. Category
 * paths ("Clothing:Jackets") create the category and subcategory as needed.
 */
@Injectable()
export class ProductsImportService {
  private readonly logger = new Logger(ProductsImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async import(
    tenantId: string,
    actorRole: UserRole,
    file: { buffer: Buffer; originalname?: string },
  ): Promise<ImportSummary> {
    const rows = await this.parse(file);
    const summary: ImportSummary = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const { rowNumber, cells } of rows) {
      const name = asText(cells.get(H.name) ?? '');
      if (!name) continue; // blank/padding rows
      // The template ships with a trailing guide section — stop when it starts.
      if (name.startsWith('Guide (')) break;

      summary.total++;
      try {
        const outcome = await this.importRow(tenantId, actorRole, name, cells);
        summary[outcome]++;
      } catch (err) {
        summary.failed++;
        const message = err instanceof Error ? err.message : 'Could not import row';
        summary.errors.push({ row: rowNumber, message: `${name}: ${message}` });
      }
    }

    this.logger.log(
      `Product import for ${tenantId}: ${summary.created} created, ${summary.updated} updated, ` +
        `${summary.skipped} skipped, ${summary.failed} failed (${summary.total} rows)`,
    );
    return summary;
  }

  private async importRow(
    tenantId: string,
    actorRole: UserRole,
    name: string,
    cells: Map<string, string | number | Date>,
  ): Promise<'created' | 'updated'> {
    const get = (h: string) => cells.get(h) ?? '';
    const sku = asText(get(H.sku)) || undefined;
    const type = asItemType(get(H.type));
    const { categoryId, subcategoryId } = await this.resolveCategoryPath(
      tenantId,
      asText(get(H.category)),
    );

    const dto: CreateProductDto = {
      name,
      type,
      sku,
      description: asText(get(H.salesDescription)) || undefined,
      categoryId,
      subcategoryId,
      unitPrice: asNumber(get(H.salesPrice)) ?? 0,
      purchaseDescription: asText(get(H.purchaseDescription)) || undefined,
      costPrice: asNumber(get(H.purchaseCost)),
      quantityOnHand: type === 'Inventory' ? (asNumber(get(H.quantityOnHand)) ?? 0) : 0,
      quantityAsOfDate: type === 'Inventory' ? asDate(get(H.quantityAsOfDate)) : undefined,
      reorderLevel: type === 'Inventory' ? asNumber(get(H.reorderPoint)) : undefined,
    };

    // Match an existing product by SKU first (unique per tenant), else by name.
    const existing = await this.prisma.product.findFirst({
      where: sku
        ? { tenantId, sku }
        : { tenantId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });

    const saved = existing
      ? await this.productsService.update(tenantId, existing.id, dto, actorRole)
      : await this.productsService.create(tenantId, dto);

    // Mirror the sheet's account names for display; syncs overwrite them with
    // the resolved QuickBooks accounts later.
    const incomeAccount = asText(get(H.incomeAccount));
    const expenseAccount = asText(get(H.expenseAccount));
    const inventoryAssetAccount = asText(get(H.inventoryAssetAccount));
    if (incomeAccount || expenseAccount || inventoryAssetAccount) {
      await this.prisma.product.update({
        where: { id: saved.id },
        data: {
          ...(incomeAccount ? { incomeAccount } : {}),
          ...(expenseAccount ? { expenseAccount } : {}),
          ...(inventoryAssetAccount ? { inventoryAssetAccount } : {}),
        },
      });
    }

    return existing ? 'updated' : 'created';
  }

  /**
   * "Clothing:Jackets" → category "Clothing" + subcategory "Jackets", created
   * if missing. Deeper QBO paths use the first two levels (our tree is 2-deep).
   */
  private async resolveCategoryPath(
    tenantId: string,
    path: string,
  ): Promise<{ categoryId?: string; subcategoryId?: string }> {
    if (!path) return {};
    const [categoryName, subcategoryName] = path.split(':').map((s) => s.trim());
    if (!categoryName) return {};

    let category = await this.prisma.productCategory.findFirst({
      where: { tenantId, name: { equals: categoryName, mode: 'insensitive' } },
    });
    category ??= await this.prisma.productCategory.create({
      data: { tenantId, name: categoryName },
    });

    if (!subcategoryName) return { categoryId: category.id };

    let subcategory = await this.prisma.productSubcategory.findFirst({
      where: {
        tenantId,
        categoryId: category.id,
        name: { equals: subcategoryName, mode: 'insensitive' },
      },
    });
    subcategory ??= await this.prisma.productSubcategory.create({
      data: {
        tenantId,
        categoryId: category.id,
        name: subcategoryName,
        slug: slugify(subcategoryName),
      },
    });

    return { categoryId: category.id, subcategoryId: subcategory.id };
  }

  /** Read the sheet (first worksheet) into header-keyed rows. */
  private async parse(file: {
    buffer: Buffer;
    originalname?: string;
  }): Promise<Array<{ rowNumber: number; cells: Map<string, string | number | Date> }>> {
    const workbook = new ExcelJS.Workbook();
    const isCsv = (file.originalname ?? '').toLowerCase().endsWith('.csv');
    try {
      if (isCsv) {
        await workbook.csv.read(Readable.from(file.buffer));
      } else {
        await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
      }
    } catch {
      throw new BadRequestException(
        'Could not read the file — upload the QuickBooks products template as .xlsx or .csv',
      );
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The uploaded file has no sheets');

    // Header row: must contain the template's name column.
    let headerRowNumber = 0;
    const headerByIndex = new Map<number, string>();
    sheet.eachRow({ includeEmpty: false }, (row, n) => {
      if (headerRowNumber) return;
      const values = (row.values as CellValue[]).slice(1).map(plain);
      if (values.some((v) => asText(v) === H.name)) {
        headerRowNumber = n;
        values.forEach((v, i) => {
          const label = asText(v);
          if (label) headerByIndex.set(i, label);
        });
      }
    });
    if (!headerRowNumber) {
      throw new BadRequestException(
        `Header row not found — the sheet needs a "${H.name}" column like the QuickBooks template`,
      );
    }

    const rows: Array<{ rowNumber: number; cells: Map<string, string | number | Date> }> = [];
    sheet.eachRow({ includeEmpty: false }, (row, n) => {
      if (n <= headerRowNumber) return;
      const values = (row.values as CellValue[]).slice(1).map(plain);
      const cells = new Map<string, string | number | Date>();
      headerByIndex.forEach((label, i) => cells.set(label, values[i] ?? ''));
      rows.push({ rowNumber: n, cells });
    });
    return rows;
  }
}
