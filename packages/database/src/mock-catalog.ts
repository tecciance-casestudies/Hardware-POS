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
  category: string;
  unitPrice: number;
  quantityOnHand: number;
  /** QuickBooks item type: Inventory | NonInventory | Service. */
  type: string;
  description?: string;
}

// `unitPrice` values are in LKR (Sri Lankan Rupees) — the POS operates in LKR.
export const MOCK_HARDWARE_PRODUCTS: MockCatalogProduct[] = [
  {
    quickbooksItemId: 'QBO-ITEM-1001',
    name: 'Cement 50kg Bag',
    sku: 'CEM-50',
    category: 'Building Materials',
    unitPrice: 2650,
    quantityOnHand: 120,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1002',
    name: 'PVC Pipe 2 inch',
    sku: 'PVC-2IN',
    category: 'Plumbing',
    unitPrice: 1450,
    quantityOnHand: 200,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1003',
    name: 'Paint Brush 2 inch',
    sku: 'BRSH-2IN',
    category: 'Paint & Supplies',
    unitPrice: 380,
    quantityOnHand: 350,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1004',
    name: 'Door Lock Set',
    sku: 'LOCK-STD',
    category: 'Hardware & Fittings',
    unitPrice: 4850,
    quantityOnHand: 60,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1005',
    name: 'Electrical Wire 1mm',
    sku: 'WIRE-1MM',
    category: 'Electrical',
    unitPrice: 95,
    quantityOnHand: 5000,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1006',
    name: 'Tile Adhesive 20kg',
    sku: 'ADH-20',
    category: 'Building Materials',
    unitPrice: 3400,
    quantityOnHand: 90,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1007',
    name: 'Screw Box 1 inch',
    sku: 'SCRW-1IN',
    category: 'Hardware & Fittings',
    unitPrice: 1050,
    quantityOnHand: 240,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1008',
    name: 'Safety Gloves',
    sku: 'GLOV-STD',
    category: 'Safety',
    unitPrice: 640,
    quantityOnHand: 300,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1009',
    name: 'Water Tap',
    sku: 'TAP-STD',
    category: 'Plumbing',
    unitPrice: 2100,
    quantityOnHand: 150,
    type: 'Inventory',
  },
  {
    quickbooksItemId: 'QBO-ITEM-1010',
    name: 'Wall Paint 4L',
    sku: 'PAINT-4L',
    category: 'Paint & Supplies',
    unitPrice: 6750,
    quantityOnHand: 80,
    type: 'Inventory',
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
