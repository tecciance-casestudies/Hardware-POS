'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';

import { SyncBadge } from '@/components/quickbooks/sync-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { formatQbTime, useQuickBooks } from '@/lib/quickbooks';
import { syncQuickBooksProducts, type SyncProductsSummary } from '@/lib/quickbooks-api';
import { cn, formatMoney } from '@/lib/utils';

export default function QuickBooksProductsPage() {
  const { state, syncProducts } = useQuickBooks();
  const { session, hasPermission } = useAuth();
  const canManage = hasPermission(Permission.QUICKBOOKS_MANAGE);

  const [syncing, setSyncing] = React.useState(false);
  const [result, setResult] = React.useState<SyncProductsSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSync = async () => {
    if (!session) return;
    setSyncing(true);
    setError(null);
    syncProducts(); // animate the local table (mock store)
    try {
      setResult(await syncQuickBooksProducts(session));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (!state.connected) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Connect QuickBooks to sync products.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {state.products.length} products cached from QuickBooks · last pull{' '}
          {formatQbTime(state.productSync.lastSyncISO)}
        </p>
        <Button onClick={handleSync} disabled={!canManage || syncing}>
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          Sync Products
        </Button>
      </div>

      {result ? (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 text-sm font-medium">
              Sync complete · {result.total} items processed
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultTile label="Created" value={result.created} tone="success" />
              <ResultTile label="Updated" value={result.updated} tone="primary" />
              <ResultTile label="Skipped" value={result.skipped} tone="neutral" />
              <ResultTile label="Failed" value={result.failed} tone={result.failed > 0 ? 'danger' : 'neutral'} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">QuickBooks Item</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">On hand</th>
                <th className="px-4 py-3 font-medium">Sync</th>
                <th className="px-4 py-3 font-medium">Last synced</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.quickbooksItemId}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(p.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">{p.quantityOnHand}</td>
                  <td className="px-4 py-3">
                    <SyncBadge status={p.syncStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatQbTime(p.lastSyncISO)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ResultTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'primary' | 'neutral' | 'danger';
}) {
  const toneClass = {
    success: 'text-success',
    primary: 'text-primary',
    neutral: 'text-foreground',
    danger: 'text-danger',
  }[tone];
  return (
    <div className="rounded-xl border border-border p-3 text-center">
      <div className={cn('text-2xl font-semibold', toneClass)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
