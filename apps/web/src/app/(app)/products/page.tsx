'use client';

import * as React from 'react';
import { Search, Warehouse } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { formatMoney } from '@/lib/utils';

export default function ProductsPage() {
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLowerCase();
  const rows = MOCK_PRODUCTS.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Read-only cache from QuickBooks. Stock is not editable in the POS."
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or SKU…"
          className="pl-10"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">On hand</th>
                <th className="px-4 py-3 font-medium">Fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(p.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.quantityOnHand} {p.unitType}
                  </td>
                  <td className="px-4 py-3">
                    {p.requiresWarehousePickup ? (
                      <Badge variant="warning">
                        <Warehouse className="h-3.5 w-3.5" /> Warehouse
                      </Badge>
                    ) : (
                      <Badge>Counter</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
