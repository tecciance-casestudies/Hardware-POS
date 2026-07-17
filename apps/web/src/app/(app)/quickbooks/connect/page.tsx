'use client';

import * as React from 'react';
import { CheckCircle2, Link2, ShieldCheck } from 'lucide-react';

import { CurrencyMismatchWarning } from '@/components/quickbooks/currency-warning';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { Permission } from '@/lib/permissions';
import { formatQbTime, useQuickBooks } from '@/lib/quickbooks';

export default function QuickBooksConnectPage() {
  const { state, loading, connect, disconnect } = useQuickBooks();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(Permission.QUICKBOOKS_MANAGE);

  const [redirecting, setRedirecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleConnect = async () => {
    setRedirecting(true);
    setError(null);
    try {
      await connect(); // navigates the browser to Intuit on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the QuickBooks connection');
      setRedirecting(false);
    }
  };

  if (loading) {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Loading QuickBooks status…
        </CardContent>
      </Card>
    );
  }

  if (state.connected && state.company) {
    return (
      <Card className="max-w-xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <div className="font-semibold">Connected</div>
              <div className="text-sm text-muted-foreground">
                {state.company.name} · {state.company.currency ?? '—'} · connected{' '}
                {formatQbTime(state.connectedAtISO)}
              </div>
            </div>
          </div>
          <CurrencyMismatchWarning currency={state.company.currency} />
          <Button variant="outline" onClick={disconnect} disabled={!canManage}>
            Disconnect
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Link2 className="h-5 w-5" />
          </span>
          <CardTitle>Connect to QuickBooks Online</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          You will be redirected to Intuit to sign in and authorize access. The POS reads products,
          prices, and stock, and writes sales receipts, invoices, and payments back to QuickBooks.
        </p>

        <ul className="space-y-2 text-sm">
          {['Read products, prices, and quantity on hand', 'Create sales receipts, invoices, and payments', 'Read customers'].map(
            (line) => (
              <li key={line} className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-success" />
                {line}
              </li>
            ),
          )}
        </ul>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button size="lg" disabled={!canManage || redirecting} onClick={handleConnect}>
          <Link2 className="h-4 w-4" />
          {redirecting ? 'Redirecting to Intuit…' : 'Connect QuickBooks'}
        </Button>
        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Connecting requires an owner or admin account.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
