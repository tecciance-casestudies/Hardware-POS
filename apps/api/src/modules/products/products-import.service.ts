import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@hardware-pos/database';
import * as ExcelJS from 'exceljs';
import { Readable } from 'node:stream';

import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';
import { CreateProductDto, type ProductType } from './dto/create-product.dto';
import { ImportProductRowDto } from './dto/commit-import.dto';

/** A parsed + validated row returned by the preview step (no DB writes). */
export interface ParsedProductRow {
  /** 1-based source row in the sheet — the stable key through preview → commit. */
  rowNumber: number;
  name: string;
  type: ProductType;
  sku: string | null;
  /** Raw "Parent:Sub" category path from the sheet (created on commit). */
  categoryPath: string | null;
  description: string | null;
  unitPrice: number;
  purchaseDescription: string | null;
  costPrice: number | null;
  quantityOnHand: number;
  quantityAsOfDate: string | null;
  reorderLevel: number | null;
  incomeAccount: string | null;
  expenseAccount: string | null;
  inventoryAssetAccount: string | null;
  /** Whether this row would create a new product or update an existing match. */
  matchStatus: 'create' | 'update';
  /** Validation problems; a row is committable only when this is empty. */
  errors: string[];
}

/** Outcome of committing one reviewed row. */
export interface ImportCommitResult {
  rowNumber: number;
  productId: string | null;
  outcome: 'created' | 'updated' | 'failed';
  error?: string;
}

export interface ImportCommitSummary {
  created: number;
  updated: number;
  failed: number;
  results: ImportCommitResult[];
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

/** Column order for the downloadable template. */
const TEMPLATE_HEADERS: string[] = [
  H.name,
  H.category,
  H.type,
  H.sku,
  H.salesDescription,
  H.salesPrice,
  H.incomeAccount,
  H.purchaseDescription,
  H.purchaseCost,
  H.expenseAccount,
  H.quantityOnHand,
  H.quantityAsOfDate,
  H.reorderPoint,
  H.inventoryAssetAccount,
];

/** Example rows shipped in the template so the expected shape is obvious. */
const TEMPLATE_SAMPLES: Array<Array<string | number>> = [
  ['Cordless Drill 18V', 'Power Tools', 'Inventory', 'DRL-18V', '18V lithium-ion cordless drill', 14500, 'Sales of Product Income', 'Cordless drill 18V', 9800, 'Cost of Goods Sold', 24, '', 5, 'Inventory Asset'],
  ['Wall Plug Pack (100)', 'Fixings', 'Non-Inventory', 'WP-100', 'Pack of 100 wall plugs', 650, 'Sales of Product Income', 'Wall plugs x100', 380, 'Cost of Goods Sold', '', '', '', ''],
  ['Tool Sharpening', 'Services', 'Service', 'SVC-SHARP', 'Bench tool sharpening service', 900, 'Sales', '', '', '', '', '', '', ''],
];

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

/** Parse a numeric cell; returns the value, or 'invalid' when non-empty but not a number. */
function asNumberField(v: string | number | Date): number | null | 'invalid' {
  const s = asText(v).replace(/,/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : 'invalid';
}

/** Parse a "Quantity as of date" cell: a Date cell, M/D/YYYY, or YYYY-MM-DD. */
function asDate(v: string | number | Date): string | null | 'invalid' {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  const s = asText(v);
  if (!s) return null;
  const mdY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = mdY ? new Date(Number(mdY[3]), Number(mdY[1]) - 1, Number(mdY[2])) : new Date(s);
  return Number.isNaN(date.getTime()) ? 'invalid' : date.toISOString();
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
 * (.xlsx or .csv). A two-phase flow: {@link preview} parses and validates the
 * sheet without writing anything, so the client can review (and attach images)
 * before {@link commit} creates/updates the products through the products
 * service (queuing QuickBooks pushes exactly as manual edits do). Category
 * paths ("Clothing:Jackets") create the category and subcategory on commit.
 */
@Injectable()
export class ProductsImportService {
  private readonly logger = new Logger(ProductsImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  /** A ready-to-fill .xlsx template with the QuickBooks headers + example rows. */
  async buildTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');
    const header = ws.addRow(TEMPLATE_HEADERS);
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      cell.border = { bottom: { style: 'thin' } };
    });
    for (const sample of TEMPLATE_SAMPLES) ws.addRow(sample);
    TEMPLATE_HEADERS.forEach((h, i) => {
      ws.getColumn(i + 1).width = Math.max(14, Math.min(34, h.length + 6));
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /** Parse + validate the sheet without writing anything (the review step). */
  async preview(
    tenantId: string,
    file: { buffer: Buffer; originalname?: string },
  ): Promise<ParsedProductRow[]> {
    const rawRows = await this.parse(file);
    const rows: ParsedProductRow[] = [];
    const skuSeen = new Map<string, number>(); // lower(sku) → first rowNumber

    for (const { rowNumber, cells } of rawRows) {
      const get = (h: string) => cells.get(h) ?? '';
      const name = asText(get(H.name));
      if (!name) continue; // blank/padding row
      if (name.startsWith('Guide (')) break; // template's trailing guide block

      const errors: string[] = [];
      const type = asItemType(get(H.type));
      const sku = asText(get(H.sku)) || null;

      const unitPrice = asNumberField(get(H.salesPrice));
      if (unitPrice === 'invalid') errors.push('Sales price is not a number');
      const costPrice = asNumberField(get(H.purchaseCost));
      if (costPrice === 'invalid') errors.push('Purchase cost is not a number');
      const quantityOnHand = asNumberField(get(H.quantityOnHand));
      if (quantityOnHand === 'invalid') errors.push('Quantity on hand is not a number');
      const reorderLevel = asNumberField(get(H.reorderPoint));
      if (reorderLevel === 'invalid') errors.push('Reorder point is not a number');
      const asOf = asDate(get(H.quantityAsOfDate));
      if (asOf === 'invalid') errors.push('Quantity as of date is not a valid date');

      if (sku) {
        const key = sku.toLowerCase();
        const firstAt = skuSeen.get(key);
        if (firstAt) errors.push(`Duplicate SKU "${sku}" (also on row ${firstAt})`);
        else skuSeen.set(key, rowNumber);
      }

      const existing = await this.prisma.product.findFirst({
        where: sku ? { tenantId, sku } : { tenantId, name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });

      const isInventory = type === 'Inventory';
      rows.push({
        rowNumber,
        name,
        type,
        sku,
        categoryPath: asText(get(H.category)) || null,
        description: asText(get(H.salesDescription)) || null,
        unitPrice: typeof unitPrice === 'number' ? unitPrice : 0,
        purchaseDescription: asText(get(H.purchaseDescription)) || null,
        costPrice: typeof costPrice === 'number' ? costPrice : null,
        quantityOnHand: isInventory && typeof quantityOnHand === 'number' ? quantityOnHand : 0,
        quantityAsOfDate: isInventory && typeof asOf === 'string' ? asOf : null,
        reorderLevel: isInventory && typeof reorderLevel === 'number' ? reorderLevel : null,
        incomeAccount: asText(get(H.incomeAccount)) || null,
        expenseAccount: asText(get(H.expenseAccount)) || null,
        inventoryAssetAccount: asText(get(H.inventoryAssetAccount)) || null,
        matchStatus: existing ? 'update' : 'create',
        errors,
      });
    }

    if (rows.length === 0) {
      throw new BadRequestException('No product rows found in the sheet');
    }
    return rows;
  }

  /** Create/update the reviewed rows and report each row's outcome + product id. */
  async commit(
    tenantId: string,
    actorRole: UserRole,
    rows: ImportProductRowDto[],
  ): Promise<ImportCommitSummary> {
    const summary: ImportCommitSummary = { created: 0, updated: 0, failed: 0, results: [] };

    for (const row of rows) {
      try {
        const result = await this.commitRow(tenantId, actorRole, row);
        summary[result.outcome === 'created' ? 'created' : 'updated']++;
        summary.results.push(result);
      } catch (err) {
        summary.failed++;
        summary.results.push({
          rowNumber: row.rowNumber,
          productId: null,
          outcome: 'failed',
          error: err instanceof Error ? err.message : 'Could not import row',
        });
      }
    }

    this.logger.log(
      `Product import commit for ${tenantId}: ${summary.created} created, ${summary.updated} updated, ${summary.failed} failed`,
    );
    return summary;
  }

  private async commitRow(
    tenantId: string,
    actorRole: UserRole,
    row: ImportProductRowDto,
  ): Promise<ImportCommitResult> {
    const { categoryId, subcategoryId } = await this.resolveCategoryPath(
      tenantId,
      row.categoryPath ?? '',
    );
    const isInventory = row.type === 'Inventory';

    const dto: CreateProductDto = {
      name: row.name,
      type: row.type,
      sku: row.sku ?? undefined,
      description: row.description ?? undefined,
      categoryId,
      subcategoryId,
      unitPrice: row.unitPrice ?? 0,
      purchaseDescription: row.purchaseDescription ?? undefined,
      costPrice: row.costPrice ?? undefined,
      quantityOnHand: isInventory ? (row.quantityOnHand ?? 0) : 0,
      quantityAsOfDate: isInventory ? (row.quantityAsOfDate ?? undefined) : undefined,
      reorderLevel: isInventory ? (row.reorderLevel ?? undefined) : undefined,
    };

    const existing = await this.prisma.product.findFirst({
      where: row.sku
        ? { tenantId, sku: row.sku }
        : { tenantId, name: { equals: row.name, mode: 'insensitive' } },
      select: { id: true },
    });

    const saved = existing
      ? await this.productsService.update(tenantId, existing.id, dto, actorRole)
      : await this.productsService.create(tenantId, dto);

    // Mirror the sheet's account names for display; syncs overwrite them with
    // the resolved QuickBooks accounts later.
    if (row.incomeAccount || row.expenseAccount || row.inventoryAssetAccount) {
      await this.prisma.product.update({
        where: { id: saved.id },
        data: {
          ...(row.incomeAccount ? { incomeAccount: row.incomeAccount } : {}),
          ...(row.expenseAccount ? { expenseAccount: row.expenseAccount } : {}),
          ...(row.inventoryAssetAccount ? { inventoryAssetAccount: row.inventoryAssetAccount } : {}),
        },
      });
    }

    return {
      rowNumber: row.rowNumber,
      productId: saved.id,
      outcome: existing ? 'updated' : 'created',
    };
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
