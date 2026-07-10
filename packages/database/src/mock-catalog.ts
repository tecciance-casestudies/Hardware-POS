/**
 * Mock hardware catalog — stands in for products that would normally be pulled
 * from QuickBooks Online (the inventory master). Used by both the dev seed and
 * the `POST /products/sync/mock` endpoint so they stay in sync.
 *
 * This file has no runtime dependencies (pure data) so it is safe to import
 * from the Prisma seed (via tsx) and from the API alike.
 */

export interface MockCatalogProduct {
  quickbooksItemId: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unitType: string;
  unitPrice: number;
  quantityOnHand: number;
  type: string;
  /** Bulky/heavy items are picked from the warehouse, not handed over at the till. */
  requiresWarehousePickup?: boolean;
  description?: string;
}

export const MOCK_HARDWARE_PRODUCTS: MockCatalogProduct[] = [
  {
    quickbooksItemId: 'QBO-ITEM-1001',
    name: 'Cement 50kg Bag',
    sku: 'CEM-50',
    barcode: '6001234500011',
    category: 'Building Materials',
    unitType: 'BAG',
    unitPrice: 8.5,
    quantityOnHand: 120,
    type: 'Inventory',
    requiresWarehousePickup: true,
  },
  {
    quickbooksItemId: 'QBO-ITEM-1002',
    name: 'PVC Pipe 2 inch',
    sku: 'PVC-2IN',
    barcode: '6001234500028',
    category: 'Plumbing',
    unitType: 'LENGTH',
    unitPrice: 4.75,
    quantityOnHand: 200,
    type: 'Inventory',
    requiresWarehousePickup: true,
  },
  {
    quickbooksItemId: 'QBO-ITEM-1003',
    name: 'Paint Brush 2 inch',
    sku: 'BRSH-2IN',
    barcode: '6001234500035',
    category: 'Paint & Supplies',
    unitType: 'PIECE',
    unitPrice: 1.2,
    quantityOnHand: 350,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1004',
    name: 'Door Lock Set',
    sku: 'LOCK-STD',
    barcode: '6001234500042',
    category: 'Hardware & Fittings',
    unitType: 'SET',
    unitPrice: 15.99,
    quantityOnHand: 60,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1005',
    name: 'Electrical Wire 1mm',
    sku: 'WIRE-1MM',
    barcode: '6001234500059',
    category: 'Electrical',
    unitType: 'METER',
    unitPrice: 0.65,
    quantityOnHand: 5000,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1006',
    name: 'Tile Adhesive 20kg',
    sku: 'ADH-20',
    barcode: '6001234500066',
    category: 'Building Materials',
    unitType: 'BAG',
    unitPrice: 11.25,
    quantityOnHand: 90,
    type: 'Inventory',
    requiresWarehousePickup: true,
  },
  {
    quickbooksItemId: 'QBO-ITEM-1007',
    name: 'Screw Box 1 inch',
    sku: 'SCRW-1IN',
    barcode: '6001234500073',
    category: 'Hardware & Fittings',
    unitType: 'BOX',
    unitPrice: 3.4,
    quantityOnHand: 240,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1008',
    name: 'Safety Gloves',
    sku: 'GLOV-STD',
    barcode: '6001234500080',
    category: 'Safety',
    unitType: 'PAIR',
    unitPrice: 2.1,
    quantityOnHand: 300,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1009',
    name: 'Water Tap',
    sku: 'TAP-STD',
    barcode: '6001234500097',
    category: 'Plumbing',
    unitType: 'PIECE',
    unitPrice: 6.8,
    quantityOnHand: 150,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1010',
    name: 'Wall Paint 4L',
    sku: 'PAINT-4L',
    barcode: '6001234500103',
    category: 'Paint & Supplies',
    unitType: 'CAN',
    unitPrice: 22.0,
    quantityOnHand: 80,
    type: 'Inventory',
    requiresWarehousePickup: true,
  },
];

/** Deterministic category id so repeated syncs/seeds are idempotent (no dupes). */
export function mockCategoryId(tenantId: string, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `cat_${tenantId}_${slug}`;
}

/** Distinct category names in catalog order. */
export function mockCategoryNames(): string[] {
  return [...new Set(MOCK_HARDWARE_PRODUCTS.map((p) => p.category))];
}
