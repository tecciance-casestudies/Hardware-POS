/** Mock hardware catalog for the UI, mirroring the API seed. Replace with API calls later. */

export interface MockProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitType: string;
  unitPrice: number;
  quantityOnHand: number;
  requiresWarehousePickup: boolean;
}

export const MOCK_PRODUCTS: MockProduct[] = [
  { id: 'p1', name: 'Cement 50kg Bag', sku: 'CEM-50', category: 'Building Materials', unitType: 'BAG', unitPrice: 8.5, quantityOnHand: 120, requiresWarehousePickup: true },
  { id: 'p2', name: 'PVC Pipe 2 inch', sku: 'PVC-2IN', category: 'Plumbing', unitType: 'LENGTH', unitPrice: 4.75, quantityOnHand: 200, requiresWarehousePickup: true },
  { id: 'p3', name: 'Paint Brush 2 inch', sku: 'BRSH-2IN', category: 'Paint & Supplies', unitType: 'PIECE', unitPrice: 1.2, quantityOnHand: 350, requiresWarehousePickup: false },
  { id: 'p4', name: 'Door Lock Set', sku: 'LOCK-STD', category: 'Hardware & Fittings', unitType: 'SET', unitPrice: 15.99, quantityOnHand: 60, requiresWarehousePickup: false },
  { id: 'p5', name: 'Electrical Wire 1mm', sku: 'WIRE-1MM', category: 'Electrical', unitType: 'METER', unitPrice: 0.65, quantityOnHand: 5000, requiresWarehousePickup: false },
  { id: 'p6', name: 'Tile Adhesive 20kg', sku: 'ADH-20', category: 'Building Materials', unitType: 'BAG', unitPrice: 11.25, quantityOnHand: 90, requiresWarehousePickup: true },
  { id: 'p7', name: 'Screw Box 1 inch', sku: 'SCRW-1IN', category: 'Hardware & Fittings', unitType: 'BOX', unitPrice: 3.4, quantityOnHand: 240, requiresWarehousePickup: false },
  { id: 'p8', name: 'Safety Gloves', sku: 'GLOV-STD', category: 'Safety', unitType: 'PAIR', unitPrice: 2.1, quantityOnHand: 300, requiresWarehousePickup: false },
  { id: 'p9', name: 'Water Tap', sku: 'TAP-STD', category: 'Plumbing', unitType: 'PIECE', unitPrice: 6.8, quantityOnHand: 150, requiresWarehousePickup: false },
  { id: 'p10', name: 'Wall Paint 4L', sku: 'PAINT-4L', category: 'Paint & Supplies', unitType: 'CAN', unitPrice: 22.0, quantityOnHand: 80, requiresWarehousePickup: true },
];
