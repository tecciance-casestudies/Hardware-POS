'use client';

import Link from 'next/link';
import { Building2, Link2, Link2Off, RefreshCw, ScrollText } from 'lucide-react';

import { SyncBadge } from '@/components/quickbooks/sync-badge';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { formatQbTime, useQuickBooks } from '@/lib/quickbooks';
import { cn } from '@/lib/utils';

export default function QuickBooksOverviewPage() {
  const { state, disconnect, syncProducts } = useQuickBooks();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(Permission.QUICKBOOKS_MANAGE);

  return (
    <div className="space-y-6">
      {/* Connection */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Link2 className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Connection</CardTitle>
              <p className="text-sm text-muted-foreground">
                {state.company ? `${state.company.environment} environment` : 'Not connected'}
              </p>
            </div>
          </div>
          <Badge variant={state.connected ? 'success' : 'danger'}>
            {state.connected ? 'Connected' : 'Not connected'}
          </Badge>
        </CardHeader>

        <CardContent className="border-t border-border pt-6">
          {state.connected && state.company ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Connected company" value={state.company.name} icon />
                <Field label="Realm ID" value={state.company.realmId} />
                <Field label="Last sync" value={formatQbTime(state.lastSyncISO)} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  onClick={syncProducts}
                  disabled={!canManage || state.productSync.status === 'SYNCING'}
                >
                  <RefreshCw
                    className={cn('h-4 w-4', state.productSync.status === 'SYNCING' && 'animate-spin')}
                  />
                  Sync Products
                </Button>
                <Link href="/quickbooks/sync-log" className={buttonVariants({ variant: 'outline' })}>
                  <ScrollText className="h-4 w-4" />
                  View Sync Log
                </Link>
                <Button variant="outline" onClick={disconnect} disabled={!canManage}>
                  <Link2Off className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
              {!canManage ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Managing the connection requires an owner or admin account.
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-muted-foreground">
                Connect your QuickBooks Online company to sync products, prices, stock, and sales.
              </p>
              <Link href="/quickbooks/connect" className={buttonVariants()}>
                <Link2 className="h-4 w-4" />
                Connect QuickBooks
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync status */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="text-sm text-muted-foreground">Product sync</div>
            <SyncBadge status={state.productSync.status} />
            <div className="text-sm text-muted-foreground">
              {state.productSync.count} products · {formatQbTime(state.productSync.lastSyncISO)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="text-sm text-muted-foreground">Sales sync</div>
            <SyncBadge status={state.salesSync.status} />
            <div className="text-sm text-muted-foreground">
              {state.salesSync.pushed} sales pushed · {formatQbTime(state.salesSync.lastSyncISO)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="text-sm text-muted-foreground">Sync errors</div>
            <div
              className={cn(
                'text-2xl font-semibold',
                state.errorsCount > 0 ? 'text-danger' : 'text-foreground',
              )}
            >
              {state.errorsCount}
            </div>
            <Link href="/quickbooks/sync-log" className="text-sm text-primary hover:underline">
              View sync log →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5 font-medium">
        {icon ? <Building2 className="h-4 w-4 text-muted-foreground" /> : null}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
